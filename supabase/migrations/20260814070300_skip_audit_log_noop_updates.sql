-- A "Save" that doesn't actually change anything still runs a real UPDATE
-- (which bumps updated_at via the moddatetime trigger), and until now that
-- produced an audit_log row whose only "change" was the timestamp -- pure
-- noise that reads as "something was modified" with nothing to show for it.
-- Skip logging UPDATE entirely when the only difference is updated_at.
create or replace function fn_audit_row() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed_by uuid;
  v_record_id uuid;
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
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
