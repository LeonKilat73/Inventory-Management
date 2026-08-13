-- Suppliers, purchase orders, and the stock ledger. See section 3 of the
-- architecture notes: items has no quantity column -- current stock is
-- always derived from stock_movements, which is append-only (insert-only
-- RLS below, no update/delete policy at all).

create table suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  email         text,
  phone         text,
  address       text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  po_number     text not null unique,
  supplier_id   uuid not null references suppliers(id),
  status        text not null default 'draft'
                  check (status in ('draft', 'submitted', 'partially_received', 'received', 'cancelled')),
  ordered_at    date,
  expected_at   date,
  created_by    uuid references profiles(id),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table purchase_order_lines (
  id                  uuid primary key default gen_random_uuid(),
  purchase_order_id   uuid not null references purchase_orders(id) on delete cascade,
  item_id             uuid not null references items(id),
  quantity_ordered    integer not null check (quantity_ordered > 0),
  quantity_received   integer not null default 0 check (quantity_received >= 0),
  unit_cost           numeric(12,2) not null,
  unique (purchase_order_id, item_id)
);

create table stock_movements (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null references items(id),
  quantity_delta    integer not null,
  movement_type     text not null check (movement_type in (
                       'po_receipt', 'sale', 'replacement_out', 'replacement_in',
                       'defective_removal', 'defective_return_to_stock',
                       'manual_adjustment', 'bundle_assembly', 'bundle_disassembly'
                     )),
  reference_table   text,
  reference_id      uuid,
  note              text,
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now()
);

create index stock_movements_item_created_idx on stock_movements (item_id, created_at);

create trigger set_purchase_orders_updated_at
  before update on purchase_orders
  for each row execute function extensions.moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- Derived stock levels. Never stored -- always summed from the ledger, so
-- the ledger and the audit trail are the same data. LEFT JOIN from items so
-- an item with zero movements still shows up with 0 rather than being
-- absent from the view entirely.
-- ---------------------------------------------------------------------------

create view item_stock_levels as
select i.id as item_id, coalesce(sum(sm.quantity_delta), 0)::integer as current_stock
from items i
left join stock_movements sm on sm.item_id = i.id
group by i.id;

-- A bundle's own stock is computed from constituents, never written to
-- directly: min(constituent_stock / qty_required) across all constituents.
create view bundle_stock_levels as
select bi.bundle_id, min(floor(isl.current_stock::numeric / bi.quantity))::integer as available
from bundle_items bi
join item_stock_levels isl on isl.item_id = bi.item_id
group by bi.bundle_id;

-- ---------------------------------------------------------------------------
-- Receiving a PO line is a multi-table, must-be-atomic operation (bump
-- quantity_received, post a stock_movements row, recompute the PO's overall
-- status). Wrapped in one security definer function so it's a single
-- transaction rather than several sequential client calls that could leave
-- inconsistent state if one step failed. auth.uid() still resolves correctly
-- inside a security definer function called via the normal authenticated
-- client (it reads the request JWT claim, not the executing role), so the
-- permission check and audit attribution both work without needing the
-- service-role client.
create function receive_purchase_order_line(p_line_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line purchase_order_lines%rowtype;
  v_po_id uuid;
  v_po_status text;
  v_remaining_lines integer;
  v_fully_received_lines integer;
  v_total_lines integer;
begin
  if not fn_has_permission(auth.uid(), 'purchase_orders', 'receive') then
    raise exception 'You do not have permission to receive purchase orders.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity to receive must be positive.';
  end if;

  select * into v_line from purchase_order_lines where id = p_line_id for update;
  if not found then
    raise exception 'Purchase order line not found.';
  end if;

  select status into v_po_status from purchase_orders where id = v_line.purchase_order_id;
  if v_po_status not in ('submitted', 'partially_received') then
    raise exception 'Purchase order must be submitted before it can be received (current status: %).', v_po_status;
  end if;

  if p_quantity > (v_line.quantity_ordered - v_line.quantity_received) then
    raise exception 'Cannot receive more than the remaining ordered quantity.';
  end if;

  update purchase_order_lines
  set quantity_received = quantity_received + p_quantity
  where id = p_line_id;

  insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, created_by)
  values (v_line.item_id, p_quantity, 'po_receipt', 'purchase_order_lines', p_line_id, auth.uid());

  v_po_id := v_line.purchase_order_id;

  select count(*), count(*) filter (where quantity_received >= quantity_ordered)
  into v_total_lines, v_fully_received_lines
  from purchase_order_lines
  where purchase_order_id = v_po_id;

  select count(*) into v_remaining_lines
  from purchase_order_lines
  where purchase_order_id = v_po_id and quantity_received > 0;

  update purchase_orders
  set status = case
    when v_fully_received_lines = v_total_lines then 'received'
    when v_remaining_lines > 0 then 'partially_received'
    else status
  end
  where id = v_po_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_lines enable row level security;
alter table stock_movements enable row level security;

create policy suppliers_select on suppliers
  for select using (fn_has_permission(auth.uid(), 'suppliers', 'view'));
create policy suppliers_insert on suppliers
  for insert with check (fn_has_permission(auth.uid(), 'suppliers', 'create'));
create policy suppliers_update on suppliers
  for update using (fn_has_permission(auth.uid(), 'suppliers', 'edit'))
  with check (fn_has_permission(auth.uid(), 'suppliers', 'edit'));
create policy suppliers_delete on suppliers
  for delete using (fn_has_permission(auth.uid(), 'suppliers', 'delete'));

create policy purchase_orders_select on purchase_orders
  for select using (fn_has_permission(auth.uid(), 'purchase_orders', 'view'));
create policy purchase_orders_insert on purchase_orders
  for insert with check (fn_has_permission(auth.uid(), 'purchase_orders', 'create'));
-- Update policy covers app-level edits (status draft->submitted, notes, etc).
-- Receiving instead goes through receive_purchase_order_line() above, which
-- carries its own permission check and runs as security definer.
create policy purchase_orders_update on purchase_orders
  for update using (fn_has_permission(auth.uid(), 'purchase_orders', 'edit'))
  with check (fn_has_permission(auth.uid(), 'purchase_orders', 'edit'));
create policy purchase_orders_delete on purchase_orders
  for delete using (fn_has_permission(auth.uid(), 'purchase_orders', 'delete'));

create policy purchase_order_lines_select on purchase_order_lines
  for select using (fn_has_permission(auth.uid(), 'purchase_orders', 'view'));
create policy purchase_order_lines_insert on purchase_order_lines
  for insert with check (fn_has_permission(auth.uid(), 'purchase_orders', 'create'));
create policy purchase_order_lines_update on purchase_order_lines
  for update using (fn_has_permission(auth.uid(), 'purchase_orders', 'edit'))
  with check (fn_has_permission(auth.uid(), 'purchase_orders', 'edit'));
create policy purchase_order_lines_delete on purchase_order_lines
  for delete using (fn_has_permission(auth.uid(), 'purchase_orders', 'delete'));

create policy stock_movements_select on stock_movements
  for select using (fn_has_permission(auth.uid(), 'stock_movements', 'view'));
-- Insert-only, no update/delete policy: the ledger is immutable. This
-- covers direct client inserts (manual sale/adjustment entries); PO-receipt
-- movements are inserted by receive_purchase_order_line() as the function
-- owner, which bypasses RLS regardless.
create policy stock_movements_insert on stock_movements
  for insert with check (fn_has_permission(auth.uid(), 'stock_movements', 'create'));

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

create trigger audit_suppliers
  after insert or update or delete on suppliers
  for each row execute function fn_audit_row();
create trigger audit_purchase_orders
  after insert or update or delete on purchase_orders
  for each row execute function fn_audit_row();
create trigger audit_purchase_order_lines
  after insert or update or delete on purchase_order_lines
  for each row execute function fn_audit_row();
create trigger audit_stock_movements
  after insert on stock_movements
  for each row execute function fn_audit_row();
