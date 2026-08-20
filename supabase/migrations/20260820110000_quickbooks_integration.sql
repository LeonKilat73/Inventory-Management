-- QuickBooks Online integration, Phase 1: OAuth connection only. No catalog
-- sync or sales backfill yet -- see CHANGELOG.md. Registers a new
-- permission module (same pattern as api_keys, 20260814042557_api_keys.sql)
-- and a table to hold the connection's tokens.

insert into permission_modules (module) values ('quickbooks');

insert into role_permissions (role_id, module, action, allowed)
select r.id, 'quickbooks', a.action, true
from roles r
cross join permission_actions a
where r.name = 'admin'
on conflict (role_id, module, action) do nothing;

-- Single-row-in-practice table (one QuickBooks company connected at a time)
-- -- not enforced with a singleton constraint since a future "disconnect and
-- reconnect to a different company" should just insert a fresh row rather
-- than fight a uniqueness rule; the app only ever reads the most recent one.
create table quickbook_connections (
  id                          uuid primary key default gen_random_uuid(),
  realm_id                    text not null,
  company_name                text,
  access_token                text not null,
  refresh_token               text not null,
  access_token_expires_at     timestamptz not null,
  refresh_token_expires_at    timestamptz not null,
  connected_by                uuid references profiles(id),
  connected_at                timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger set_quickbook_connections_updated_at
  before update on quickbook_connections
  for each row execute function extensions.moddatetime(updated_at);

alter table quickbook_connections enable row level security;

-- No select/insert/update policy for `authenticated` at all -- tokens are a
-- secret never read back through the normal client, same posture as
-- staff.pin_hash. Every read/write goes through the service-role client
-- from server code that has already called requirePermission() itself.
--
-- Deliberately NOT wired into fn_audit_row(): that trigger logs the full
-- row (to_jsonb(old)/to_jsonb(new)) into audit_log with no column
-- exclusion, which would leak the raw access/refresh tokens into a table
-- any admin can read via the Logs page -- exactly what the missing RLS
-- policies above are trying to prevent.
