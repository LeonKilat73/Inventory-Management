-- Defective items, scheduling calendar, and expense reporting.

create table defective_items (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references items(id),
  quantity       integer not null check (quantity > 0),
  reason         text,
  status         text not null default 'pending'
                   check (status in ('pending', 'returned_to_supplier', 'replaced', 'written_off', 'restocked')),
  related_po_id  uuid references purchase_orders(id),
  reported_by    uuid references profiles(id),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);

create table calendar_events (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  event_type            text not null check (event_type in ('delivery', 'restock_task', 'supplier_meeting', 'other')),
  starts_at             timestamptz not null,
  ends_at               timestamptz,
  related_po_id         uuid references purchase_orders(id),
  related_supplier_id   uuid references suppliers(id),
  created_by            uuid references profiles(id),
  notes                 text,
  created_at            timestamptz not null default now()
);

create index calendar_events_starts_at_idx on calendar_events (starts_at);

create table expenses (
  id                  uuid primary key default gen_random_uuid(),
  source              text not null check (source in ('purchase_order', 'manual')),
  purchase_order_id   uuid references purchase_orders(id),
  amount              numeric(12,2) not null,
  category            text,
  description         text,
  incurred_at         date not null,
  created_by          uuid references profiles(id),
  created_at          timestamptz not null default now()
);

create index expenses_incurred_at_idx on expenses (incurred_at);

-- ---------------------------------------------------------------------------
-- Reporting and resolving a defective item are each multi-table operations
-- (defective_items row + a stock_movements row), so they follow the same
-- atomic-function pattern as receive_purchase_order_line().
-- ---------------------------------------------------------------------------

create function report_defective_item(
  p_item_id uuid,
  p_quantity integer,
  p_reason text,
  p_related_po_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_stock integer;
  v_id uuid;
begin
  if not fn_has_permission(auth.uid(), 'defective_items', 'create') then
    raise exception 'You do not have permission to report defective items.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be positive.';
  end if;

  select current_stock into v_current_stock from item_stock_levels where item_id = p_item_id;
  if coalesce(v_current_stock, 0) < p_quantity then
    raise exception 'Only % in stock -- cannot report % as defective.', coalesce(v_current_stock, 0), p_quantity;
  end if;

  insert into defective_items (item_id, quantity, reason, related_po_id, reported_by)
  values (p_item_id, p_quantity, nullif(p_reason, ''), p_related_po_id, auth.uid())
  returning id into v_id;

  insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, created_by)
  values (p_item_id, -p_quantity, 'defective_removal', 'defective_items', v_id, auth.uid());

  return v_id;
end;
$$;

create function resolve_defective_item(p_defective_id uuid, p_resolution text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row defective_items%rowtype;
begin
  if not fn_has_permission(auth.uid(), 'defective_items', 'edit') then
    raise exception 'You do not have permission to resolve defective items.';
  end if;

  if p_resolution not in ('returned_to_supplier', 'replaced', 'written_off', 'restocked') then
    raise exception 'Invalid resolution: %', p_resolution;
  end if;

  select * into v_row from defective_items where id = p_defective_id for update;
  if not found then
    raise exception 'Defective item report not found.';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'This report was already resolved as %.', v_row.status;
  end if;

  update defective_items
  set status = p_resolution, resolved_at = now()
  where id = p_defective_id;

  -- restocked: the removed units turned out fine, put them back.
  -- replaced: a new unit came in to replace the defective one(s).
  -- written_off / returned_to_supplier: stock stays reduced permanently.
  if p_resolution = 'restocked' then
    insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, created_by)
    values (v_row.item_id, v_row.quantity, 'defective_return_to_stock', 'defective_items', p_defective_id, auth.uid());
  elsif p_resolution = 'replaced' then
    insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, created_by)
    values (v_row.item_id, v_row.quantity, 'replacement_in', 'defective_items', p_defective_id, auth.uid());
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Receiving a PO line now also posts an expense (amount = received qty *
-- unit cost). CREATE OR REPLACE rather than editing the Phase 2 migration,
-- which is already applied -- see the audit_row fix for why.
-- ---------------------------------------------------------------------------

create or replace function receive_purchase_order_line(p_line_id uuid, p_quantity integer)
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

  insert into expenses (source, purchase_order_id, amount, category, description, incurred_at, created_by)
  values (
    'purchase_order',
    v_po_id,
    p_quantity * v_line.unit_cost,
    'inventory',
    'PO receipt: ' || p_quantity || ' unit(s)',
    current_date,
    auth.uid()
  );

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
-- Submitting a PO with an expected delivery date auto-creates a calendar
-- event. A trigger (not application code) so this fires regardless of entry
-- point -- consistent with the audit-log rationale elsewhere in this schema.
-- ---------------------------------------------------------------------------

create function fn_create_po_delivery_event() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'submitted' and old.status = 'draft' and new.expected_at is not null then
    insert into calendar_events (title, event_type, starts_at, related_po_id, related_supplier_id, created_by)
    values (
      'Delivery expected: ' || new.po_number,
      'delivery',
      new.expected_at::timestamptz,
      new.id,
      new.supplier_id,
      coalesce(auth.uid(), new.created_by)
    );
  end if;
  return new;
end;
$$;

create trigger create_po_delivery_event
  after update on purchase_orders
  for each row execute function fn_create_po_delivery_event();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table defective_items enable row level security;
alter table calendar_events enable row level security;
alter table expenses enable row level security;

create policy defective_items_select on defective_items
  for select using (fn_has_permission(auth.uid(), 'defective_items', 'view'));
-- Insert/update happen through report_defective_item()/resolve_defective_item()
-- (security definer, permission-checked internally), not direct client writes.

create policy calendar_events_select on calendar_events
  for select using (fn_has_permission(auth.uid(), 'calendar', 'view'));
create policy calendar_events_insert on calendar_events
  for insert with check (fn_has_permission(auth.uid(), 'calendar', 'create'));
create policy calendar_events_update on calendar_events
  for update using (fn_has_permission(auth.uid(), 'calendar', 'edit'))
  with check (fn_has_permission(auth.uid(), 'calendar', 'edit'));
create policy calendar_events_delete on calendar_events
  for delete using (fn_has_permission(auth.uid(), 'calendar', 'delete'));

create policy expenses_select on expenses
  for select using (fn_has_permission(auth.uid(), 'expenses', 'view'));
create policy expenses_insert on expenses
  for insert with check (fn_has_permission(auth.uid(), 'expenses', 'create'));
create policy expenses_update on expenses
  for update using (fn_has_permission(auth.uid(), 'expenses', 'edit'))
  with check (fn_has_permission(auth.uid(), 'expenses', 'edit'));
create policy expenses_delete on expenses
  for delete using (fn_has_permission(auth.uid(), 'expenses', 'delete'));

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

create trigger audit_defective_items
  after insert or update or delete on defective_items
  for each row execute function fn_audit_row();
create trigger audit_calendar_events
  after insert or update or delete on calendar_events
  for each row execute function fn_audit_row();
create trigger audit_expenses
  after insert or update or delete on expenses
  for each row execute function fn_audit_row();
