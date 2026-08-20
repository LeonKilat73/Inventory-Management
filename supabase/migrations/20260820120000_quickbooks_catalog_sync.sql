-- QuickBooks Online integration, Phase 2: catalog sync. Links existing
-- items/categories to their QuickBooks counterparts and introduces a
-- review queue for new/changed items detected in QuickBooks -- nothing
-- from QuickBooks writes into items/categories/bundles directly except the
-- low-stakes category tree (see src/lib/quickbooks/sync.ts), matching the
-- "reviewed before writing" discipline already used for the earlier manual
-- QuickBooks catalog import.

alter table items
  add column quickbooks_id text,
  add column quickbooks_synced_at timestamptz;

create unique index items_quickbooks_id_key on items (quickbooks_id) where quickbooks_id is not null;

alter table categories
  add column quickbooks_id text;

create unique index categories_quickbooks_id_key on categories (quickbooks_id) where quickbooks_id is not null;

-- Drives the incremental `where Metadata.LastUpdatedTime > ...` filter on
-- every sync after the first (which pulls everything).
alter table quickbook_connections
  add column last_item_sync_at timestamptz;

-- The review queue. A row here is a proposed change detected in
-- QuickBooks that hasn't been written into items/bundles/stock_movements
-- yet -- an admin approves or dismisses it from /admin/quickbooks. Holds
-- ordinary catalog data (no secrets), unlike quickbook_connections.
create table quickbooks_pending_changes (
  id                  uuid primary key default gen_random_uuid(),
  quickbooks_item_id  text not null,
  change_type         text not null check (change_type in ('new_item', 'updated_item', 'new_bundle', 'deactivated')),
  item_id             uuid references items(id),
  payload             jsonb not null,
  detected_at         timestamptz not null default now(),
  resolved_at         timestamptz,
  resolved_by         uuid references profiles(id),
  resolution          text check (resolution in ('applied', 'dismissed'))
);

-- At most one open (unresolved) pending change per QuickBooks item -- a
-- re-sync before the last one is reviewed updates the existing row rather
-- than piling up duplicates (see upsertPendingChange in sync.ts).
create unique index quickbooks_pending_changes_open_key
  on quickbooks_pending_changes (quickbooks_item_id)
  where resolved_at is null;

create index quickbooks_pending_changes_item_idx on quickbooks_pending_changes (item_id);

alter table quickbooks_pending_changes enable row level security;

create policy quickbooks_pending_changes_select on quickbooks_pending_changes
  for select using (fn_has_permission(auth.uid(), 'quickbooks', 'view'));
create policy quickbooks_pending_changes_update on quickbooks_pending_changes
  for update using (fn_has_permission(auth.uid(), 'quickbooks', 'edit'))
  with check (fn_has_permission(auth.uid(), 'quickbooks', 'edit'));

-- No insert/delete policy for `authenticated` -- rows are only ever
-- created by the sync process and resolved (never deleted) via the
-- service-role client from code that has already called requirePermission()
-- itself, same posture as quickbook_connections.

create trigger audit_quickbooks_pending_changes
  after insert or update or delete on quickbooks_pending_changes
  for each row execute function fn_audit_row();
