-- API keys for external integrations (e.g. a POS reading the catalog or
-- posting sales). Keys are generated app-side and only the SHA-256 hash is
-- stored -- the raw key is shown to the admin exactly once at creation time
-- and is not recoverable afterwards.

insert into permission_modules (module) values ('api_keys');

create table api_keys (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  key_hash      text not null unique,
  key_prefix    text not null,     -- first few chars of the raw key, shown in the UI to tell keys apart
  can_write     boolean not null default false,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz
);

alter table api_keys enable row level security;

create policy api_keys_select on api_keys
  for select using (fn_has_permission(auth.uid(), 'api_keys', 'view'));
create policy api_keys_insert on api_keys
  for insert with check (fn_has_permission(auth.uid(), 'api_keys', 'create'));
-- Revoking is implemented as setting revoked_at (soft delete, so old
-- audit_log rows referencing a key stay meaningful); gated behind the
-- 'delete' action since that's what revoking a key means to the admin.
create policy api_keys_revoke on api_keys
  for update using (fn_has_permission(auth.uid(), 'api_keys', 'delete'))
  with check (fn_has_permission(auth.uid(), 'api_keys', 'delete'));

create trigger audit_api_keys
  after insert or update on api_keys
  for each row execute function fn_audit_row();
