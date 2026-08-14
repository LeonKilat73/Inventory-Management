-- fn_audit_row only captured old_data on DELETE, leaving old_data null for
-- every UPDATE -- which defeats the audit log's before/after diff viewer
-- for the vast majority of rows (updates, not deletes). Capture old_data on
-- both UPDATE and DELETE; new_data stays INSERT/UPDATE as before.
create or replace function fn_audit_row() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed_by uuid;
begin
  v_changed_by := coalesce(auth.uid(), nullif(current_setting('app.current_user_id', true), '')::uuid);

  insert into audit_log (table_name, record_id, action, changed_by, old_data, new_data)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    v_changed_by,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;
