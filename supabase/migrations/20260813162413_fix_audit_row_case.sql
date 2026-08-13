-- fn_audit_row compared tg_op against lowercase literals ('insert','update',
-- 'delete'), but tg_op is always uppercase ('INSERT','UPDATE','DELETE') in
-- Postgres trigger context. old_data/new_data were silently always null as a
-- result (only `action`, via lower(tg_op), was ever set correctly).
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
    case when tg_op = 'DELETE' then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;
