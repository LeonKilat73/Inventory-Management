-- fn_audit_row used `coalesce(new.id, old.id)`, a static column reference
-- that assumes every audited table has an `id` column. notification_preferences
-- is keyed by `user_id` instead, so that reference raised
-- "record \"new\" has no field \"id\"" on every insert/update -- silently
-- breaking the create_default_notification_preferences trigger for new
-- signups and the notification-preferences save form, since Postgres
-- errors inside a trigger abort the whole statement (the row was never
-- written, even though nothing in the app surfaced it as an error until
-- checked directly with a service-role query).
--
-- Fix: read the row through to_jsonb() instead of a static field reference.
-- ->> on a missing key returns null rather than erroring, so this works for
-- both id-keyed and user_id-keyed tables (and any future table using a
-- different primary key name).
create or replace function fn_audit_row() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed_by uuid;
  v_record_id uuid;
begin
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
