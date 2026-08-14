-- In-app notifications + per-user delivery preferences. Rows are created
-- only by triggers (security definer), never by direct client insert --
-- consistent with audit_log's write model.

create table notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  type              text not null check (type in ('low_stock', 'item_modified', 'po_status', 'defective_item', 'system')),
  title             text not null,
  body              text,
  reference_table   text,
  reference_id      uuid,
  is_read           boolean not null default false,
  email_sent_at     timestamptz,
  created_at        timestamptz not null default now()
);

create index notifications_user_created_idx on notifications (user_id, created_at desc);

create table notification_preferences (
  user_id                 uuid primary key references profiles(id) on delete cascade,
  email_enabled           boolean not null default false,
  low_stock_alerts        boolean not null default true,
  item_modified_alerts    boolean not null default false
);

-- New signups get a preferences row automatically (admins default to
-- email-enabled, matching "admins/owners always" from the notification
-- design; everyone else opts in later). Fires after handle_new_user's
-- profiles insert, so it chains off the existing auth.users -> profiles
-- bootstrap from Phase 1.
create function fn_create_default_notification_preferences() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select (r.name = 'admin') into v_is_admin from roles r where r.id = new.role_id;

  insert into notification_preferences (user_id, email_enabled, low_stock_alerts, item_modified_alerts)
  values (new.id, coalesce(v_is_admin, false), true, false)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger create_default_notification_preferences
  after insert on profiles
  for each row execute function fn_create_default_notification_preferences();

-- Backfill for profiles created before this migration existed.
insert into notification_preferences (user_id, email_enabled, low_stock_alerts, item_modified_alerts)
select p.id, (r.name = 'admin'), true, false
from profiles p
join roles r on r.id = p.role_id
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Notification triggers. Each inserts one row per recipient: admins always,
-- everyone else only if their notification_preferences flag is on.
-- ---------------------------------------------------------------------------

-- Fires on every stock_movements insert but only notifies on a threshold
-- *crossing* (was above, now at-or-below) so it doesn't spam one alert per
-- movement while stock stays low.
create function fn_notify_low_stock() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_before integer;
  v_threshold integer;
  v_item_name text;
begin
  select current_stock into v_current from item_stock_levels where item_id = new.item_id;
  v_before := v_current - new.quantity_delta;

  select reorder_threshold, name into v_threshold, v_item_name from items where id = new.item_id;

  if v_before > v_threshold and v_current <= v_threshold then
    insert into notifications (user_id, type, title, body, reference_table, reference_id)
    select p.id, 'low_stock', 'Low stock: ' || v_item_name,
           v_item_name || ' is at ' || v_current || ' units (reorder threshold ' || v_threshold || ').',
           'items', new.item_id
    from profiles p
    join roles r on r.id = p.role_id
    left join notification_preferences np on np.user_id = p.id
    where p.is_active and (r.name = 'admin' or coalesce(np.low_stock_alerts, false));
  end if;

  return new;
end;
$$;

create trigger notify_low_stock
  after insert on stock_movements
  for each row execute function fn_notify_low_stock();

create function fn_notify_item_modified() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
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

create trigger notify_item_modified
  after update on items
  for each row execute function fn_notify_item_modified();

create function fn_notify_po_status() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into notifications (user_id, type, title, body, reference_table, reference_id)
    select distinct p.id, 'po_status', 'PO ' || new.po_number || ' is now ' || replace(new.status, '_', ' '),
           null, 'purchase_orders', new.id
    from profiles p
    join roles r on r.id = p.role_id
    where p.is_active and (r.name = 'admin' or p.id = new.created_by);
  end if;
  return new;
end;
$$;

create trigger notify_po_status
  after update on purchase_orders
  for each row execute function fn_notify_po_status();

create function fn_notify_defective_item() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_name text;
begin
  select name into v_item_name from items where id = new.item_id;

  insert into notifications (user_id, type, title, body, reference_table, reference_id)
  select p.id, 'defective_item', 'Defective item reported: ' || v_item_name,
         new.quantity || ' unit(s) reported defective.', 'defective_items', new.id
  from profiles p
  join roles r on r.id = p.role_id
  where p.is_active and r.name = 'admin';

  return new;
end;
$$;

create trigger notify_defective_item
  after insert on defective_items
  for each row execute function fn_notify_defective_item();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table notifications enable row level security;
alter table notification_preferences enable row level security;

-- A user's own notifications are always theirs to read/mark-read, regardless
-- of the 'notifications' module permission (that permission only gates
-- whether the UI shows the bell/nav link -- it's not a privacy boundary on
-- someone's own alerts).
create policy notifications_select on notifications
  for select using (user_id = auth.uid());
create policy notifications_update on notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- No insert/delete policy: rows are only created by the triggers above.

create policy notification_preferences_select on notification_preferences
  for select using (user_id = auth.uid() or fn_has_permission(auth.uid(), 'users', 'view'));
create policy notification_preferences_update on notification_preferences
  for update using (user_id = auth.uid() or fn_has_permission(auth.uid(), 'users', 'edit'))
  with check (user_id = auth.uid() or fn_has_permission(auth.uid(), 'users', 'edit'));

create trigger audit_notification_preferences
  after insert or update on notification_preferences
  for each row execute function fn_audit_row();

-- ---------------------------------------------------------------------------
-- Realtime: let the in-app bell subscribe to new notifications instead of
-- polling. RLS still applies to the realtime stream (a user only receives
-- postgres_changes events for rows their own select policy allows).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table notifications;
