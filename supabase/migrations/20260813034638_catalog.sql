-- Item catalog, categories, and bundles.
-- Stock levels are NOT tracked here -- see the Phase 2 stock_movements
-- ledger migration. items has no quantity column on purpose.

create table categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  parent_id uuid references categories(id)
);

create table items (
  id                 uuid primary key default gen_random_uuid(),
  sku                text not null unique,
  name               text not null,
  description        text,
  category_id        uuid references categories(id),
  unit_cost          numeric(12,2),
  unit_price         numeric(12,2),
  reorder_threshold  integer not null default 0,
  reorder_quantity   integer,
  is_active          boolean not null default true,
  is_bundle          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 1:1 extension of items where is_bundle = true.
create table bundles (
  id            uuid primary key references items(id) on delete cascade,
  bundle_price  numeric(12,2) not null
);

create table bundle_items (
  id         uuid primary key default gen_random_uuid(),
  bundle_id  uuid not null references bundles(id) on delete cascade,
  item_id    uuid not null references items(id),
  quantity   integer not null check (quantity > 0),
  unique (bundle_id, item_id)
);

-- A bundle's constituent must itself be a plain item, not another bundle.
create function fn_prevent_nested_bundle() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from items where id = new.item_id and is_bundle) then
    raise exception 'A bundle constituent cannot itself be a bundle.';
  end if;
  return new;
end;
$$;

create trigger prevent_nested_bundle
  before insert or update on bundle_items
  for each row execute function fn_prevent_nested_bundle();

create trigger set_items_updated_at
  before update on items
  for each row execute function extensions.moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table categories enable row level security;
alter table items enable row level security;
alter table bundles enable row level security;
alter table bundle_items enable row level security;

create policy categories_select on categories
  for select using (fn_has_permission(auth.uid(), 'items', 'view'));
create policy categories_insert on categories
  for insert with check (fn_has_permission(auth.uid(), 'items', 'create'));
create policy categories_update on categories
  for update using (fn_has_permission(auth.uid(), 'items', 'edit'))
  with check (fn_has_permission(auth.uid(), 'items', 'edit'));
create policy categories_delete on categories
  for delete using (fn_has_permission(auth.uid(), 'items', 'delete'));

create policy items_select on items
  for select using (fn_has_permission(auth.uid(), 'items', 'view'));
create policy items_insert on items
  for insert with check (fn_has_permission(auth.uid(), 'items', 'create'));
create policy items_update on items
  for update using (fn_has_permission(auth.uid(), 'items', 'edit'))
  with check (fn_has_permission(auth.uid(), 'items', 'edit'));
create policy items_delete on items
  for delete using (fn_has_permission(auth.uid(), 'items', 'delete'));

create policy bundles_select on bundles
  for select using (fn_has_permission(auth.uid(), 'bundles', 'view'));
create policy bundles_insert on bundles
  for insert with check (fn_has_permission(auth.uid(), 'bundles', 'create'));
create policy bundles_update on bundles
  for update using (fn_has_permission(auth.uid(), 'bundles', 'edit'))
  with check (fn_has_permission(auth.uid(), 'bundles', 'edit'));
create policy bundles_delete on bundles
  for delete using (fn_has_permission(auth.uid(), 'bundles', 'delete'));

create policy bundle_items_select on bundle_items
  for select using (fn_has_permission(auth.uid(), 'bundles', 'view'));
create policy bundle_items_insert on bundle_items
  for insert with check (fn_has_permission(auth.uid(), 'bundles', 'create'));
create policy bundle_items_update on bundle_items
  for update using (fn_has_permission(auth.uid(), 'bundles', 'edit'))
  with check (fn_has_permission(auth.uid(), 'bundles', 'edit'));
create policy bundle_items_delete on bundle_items
  for delete using (fn_has_permission(auth.uid(), 'bundles', 'delete'));

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

create trigger audit_categories
  after insert or update or delete on categories
  for each row execute function fn_audit_row();
create trigger audit_items
  after insert or update or delete on items
  for each row execute function fn_audit_row();
create trigger audit_bundles
  after insert or update or delete on bundles
  for each row execute function fn_audit_row();
create trigger audit_bundle_items
  after insert or update or delete on bundle_items
  for each row execute function fn_audit_row();
