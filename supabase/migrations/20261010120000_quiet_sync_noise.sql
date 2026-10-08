-- Quiet the housekeeping noise, and add a few indexes.
--
-- 1. Every bulk QuickBooks link/import UPDATEs hundreds of items to stamp
--    quickbooks_id / quickbooks_synced_at. Those bookkeeping columns are not
--    something an admin changed, but each one fired an "Item updated"
--    notification to every admin (about 670 unread in a real admin's bell, burying
--    low-stock and approval alerts) and a row in the audit log.
--    - fn_notify_item_modified now ignores changes confined to
--      updated_at / quickbooks_synced_at / quickbooks_id.
--    - fn_audit_row treats quickbooks_synced_at like updated_at (a pure
--      timestamp bump). quickbooks_id changes are still audited: that is a
--      real link between two systems.
--
-- 2. Foreign keys that are filtered or joined on in the app but had no
--    index. Invisible at today's size, but these tables only grow.

create or replace function fn_notify_item_modified() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'updated_at' - 'quickbooks_synced_at' - 'quickbooks_id')
     is distinct from
     (to_jsonb(old) - 'updated_at' - 'quickbooks_synced_at' - 'quickbooks_id') then
    insert into notifications (user_id, type, title, body, reference_table, reference_id)
    select p.id, 'item_modified', 'Item updated: ' || new.name, new.sku || ' was modified.',
           'items', new.id
    from profiles p
    join roles r on r.id = p.role_id
    left join notification_preferences np on np.user_id = p.id
    where p.is_active and (r.name = 'admin' or coalesce(np.item_modified_alerts, false));
  end if;
  return new;
end;
$$;

create or replace function fn_audit_row() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed_by uuid;
  v_record_id uuid;
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(old) - 'updated_at' - 'quickbooks_synced_at') = (to_jsonb(new) - 'updated_at' - 'quickbooks_synced_at') then
    return new;
  end if;

  v_changed_by := coalesce(auth.uid(), nullif(current_setting('app.current_user_id', true), '')::uuid);

  v_record_id := coalesce(
    (to_jsonb(new) ->> 'id')::uuid,
    (to_jsonb(old) ->> 'id')::uuid,
    (to_jsonb(new) ->> 'user_id')::uuid,
    (to_jsonb(old) ->> 'user_id')::uuid
  );

  insert into audit_log (table_name, record_id, action, changed_by, old_data, new_data)
  values (
    tg_table_name,
    v_record_id,
    lower(tg_op),
    v_changed_by,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create index if not exists items_category_id_idx on items (category_id);
create index if not exists bundle_items_item_id_idx on bundle_items (item_id);
create index if not exists purchase_orders_supplier_id_idx on purchase_orders (supplier_id);
create index if not exists purchase_order_lines_item_id_idx on purchase_order_lines (item_id);
create index if not exists defective_items_item_id_idx on defective_items (item_id);
create index if not exists calendar_events_related_po_id_idx on calendar_events (related_po_id);
create index if not exists expenses_purchase_order_id_idx on expenses (purchase_order_id);
