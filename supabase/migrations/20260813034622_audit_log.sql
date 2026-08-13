-- Generic, append-only audit trail. Populated only by fn_audit_row triggers
-- (attached per-table in later migrations) or by service-role code that sets
-- app.current_user_id explicitly -- never written to directly by clients.
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   uuid not null,
  action      text not null check (action in ('insert', 'update', 'delete')),
  changed_by  uuid references auth.users(id),
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_table_record_idx on audit_log (table_name, record_id);
create index audit_log_created_at_idx on audit_log (created_at);

alter table audit_log enable row level security;
-- No insert/update/delete policy at all: only the security-definer trigger
-- function (which runs as the table owner, bypassing RLS) can write here.
-- select policy is added once fn_has_permission exists (roles_and_permissions
-- migration), so admins can read the log from the UI.

-- Generic row-change logger. changed_by prefers auth.uid() (set for requests
-- made through the authenticated Supabase client); service-role code that
-- performs multi-table writes on a user's behalf must
-- `select set_config('app.current_user_id', <uuid>, true)` at the start of
-- the transaction so attribution isn't lost when auth.uid() is null.
create function fn_audit_row() returns trigger
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
    case when tg_op = 'delete' then to_jsonb(old) else null end,
    case when tg_op in ('insert', 'update') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;
