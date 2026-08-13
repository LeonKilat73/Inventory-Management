-- Identity, roles, and the role-default + per-user-override permission model.

create table roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  is_system   boolean not null default false
);

create table permission_modules (
  module text primary key
);

create table permission_actions (
  action text primary key
);

create table role_permissions (
  id        uuid primary key default gen_random_uuid(),
  role_id   uuid not null references roles(id) on delete cascade,
  module    text not null references permission_modules(module),
  action    text not null references permission_actions(action),
  allowed   boolean not null default true,
  unique (role_id, module, action)
);

create table user_permission_overrides (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,           -- FK to profiles added after profiles exists
  module      text not null references permission_modules(module),
  action      text not null references permission_actions(action),
  allowed     boolean not null,
  granted_by  uuid,
  created_at  timestamptz not null default now(),
  unique (user_id, module, action)
);

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role_id     uuid not null references roles(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table user_permission_overrides
  add constraint user_permission_overrides_user_id_fkey
    foreign key (user_id) references profiles(id) on delete cascade,
  add constraint user_permission_overrides_granted_by_fkey
    foreign key (granted_by) references profiles(id);

-- ---------------------------------------------------------------------------
-- Foundational catalog data (not sample data -- the app depends on these rows
-- existing, so they live in a migration rather than supabase/seed.sql).
-- ---------------------------------------------------------------------------

insert into permission_modules (module) values
  ('items'), ('bundles'), ('suppliers'), ('purchase_orders'), ('stock_movements'),
  ('defective_items'), ('calendar'), ('expenses'), ('notifications'),
  ('audit_log'), ('users'), ('roles');

insert into permission_actions (action) values
  ('view'), ('create'), ('edit'), ('delete'), ('receive'), ('approve'), ('export');

insert into roles (name, description, is_system) values
  ('admin', 'Full access to everything. Cannot be restricted.', true),
  ('manager', 'Day-to-day operations: catalog, suppliers, purchase orders, stock, calendar, expenses.', false),
  ('staff', 'Front-line access: view catalog/orders, report defects, log calendar events.', false),
  ('viewer', 'Read-only access across the app.', false);

-- Admin's effective permissions are hardcoded true in fn_has_permission below;
-- these rows exist too so admin shows up consistently in the UI's permission
-- matrix rather than looking empty.
insert into role_permissions (role_id, module, action, allowed)
select r.id, m.module, a.action, true
from roles r cross join permission_modules m cross join permission_actions a
where r.name = 'admin';

insert into role_permissions (role_id, module, action, allowed)
select r.id, v.module, v.action, true
from roles r
join (values
  ('items','view'), ('items','create'), ('items','edit'),
  ('bundles','view'), ('bundles','create'), ('bundles','edit'),
  ('suppliers','view'), ('suppliers','create'), ('suppliers','edit'),
  ('purchase_orders','view'), ('purchase_orders','create'), ('purchase_orders','edit'),
  ('purchase_orders','receive'), ('purchase_orders','approve'),
  ('stock_movements','view'), ('stock_movements','create'),
  ('defective_items','view'), ('defective_items','create'), ('defective_items','edit'),
  ('calendar','view'), ('calendar','create'), ('calendar','edit'),
  ('expenses','view'), ('expenses','create'), ('expenses','edit'), ('expenses','export'),
  ('notifications','view')
) as v(module, action) on true
where r.name = 'manager';

insert into role_permissions (role_id, module, action, allowed)
select r.id, v.module, v.action, true
from roles r
join (values
  ('items','view'),
  ('bundles','view'),
  ('suppliers','view'),
  ('purchase_orders','view'),
  ('stock_movements','view'), ('stock_movements','create'),
  ('defective_items','view'), ('defective_items','create'),
  ('calendar','view'), ('calendar','create'),
  ('notifications','view')
) as v(module, action) on true
where r.name = 'staff';

insert into role_permissions (role_id, module, action, allowed)
select r.id, v.module, v.action, true
from roles r
join (values
  ('items','view'), ('bundles','view'), ('suppliers','view'), ('purchase_orders','view'),
  ('stock_movements','view'), ('defective_items','view'), ('calendar','view'),
  ('expenses','view'), ('notifications','view')
) as v(module, action) on true
where r.name = 'viewer';

-- ---------------------------------------------------------------------------
-- Permission resolution
-- ---------------------------------------------------------------------------

-- Single source of truth for "can this user do this", used by both RLS
-- policies (below and in later migrations) and application code via RPC.
-- The admin role always resolves true regardless of role_permissions /
-- user_permission_overrides rows, so a single admin account can never end up
-- locked out by a bad override.
create function fn_has_permission(p_user uuid, p_module text, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role_name text;
  v_override  boolean;
  v_default   boolean;
begin
  select r.name into v_role_name
  from profiles p join roles r on r.id = p.role_id
  where p.id = p_user and p.is_active;

  if v_role_name is null then
    return false;
  end if;

  if v_role_name = 'admin' then
    return true;
  end if;

  select allowed into v_override
  from user_permission_overrides
  where user_id = p_user and module = p_module and action = p_action;

  if v_override is not null then
    return v_override;
  end if;

  select rp.allowed into v_default
  from role_permissions rp
  join profiles p on p.role_id = rp.role_id
  where p.id = p_user and rp.module = p_module and rp.action = p_action;

  return coalesce(v_default, false);
end;
$$;

-- Whole resolved permission set for a user in one call, so the app fetches
-- it once per request instead of one round trip per module/action check.
create function resolve_user_permissions(p_user uuid)
returns table (module text, action text, allowed boolean)
language sql
stable
security definer
set search_path = public
as $$
  select pm.module, pa.action, fn_has_permission(p_user, pm.module, pa.action)
  from permission_modules pm cross join permission_actions pa;
$$;

-- ---------------------------------------------------------------------------
-- New auth.users -> profiles bootstrap. The very first user to sign up
-- becomes admin automatically (no other admin can exist yet to create them);
-- every subsequent signup defaults to 'staff' until an admin changes it.
-- ---------------------------------------------------------------------------

create function handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
begin
  if not exists (select 1 from profiles) then
    select id into v_role_id from roles where name = 'admin';
  else
    select id into v_role_id from roles where name = 'staff';
  end if;

  insert into profiles (id, full_name, email, role_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_role_id
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- A user (including an admin) can never change their own role_id -- promotion
-- or demotion always requires a *different* admin. Prevents self-escalation
-- and self-lockout in one rule.
create function fn_guard_profile_role_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role_id is distinct from old.role_id and auth.uid() = old.id then
    raise exception 'You cannot change your own role. Ask another admin to do it.';
  end if;
  return new;
end;
$$;

create trigger guard_profile_role_change
  before update on profiles
  for each row execute function fn_guard_profile_role_change();

-- is_system roles (admin) can't be deleted out from under the app.
create function fn_prevent_system_role_delete() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_system then
    raise exception 'System role "%" cannot be deleted.', old.name;
  end if;
  return old;
end;
$$;

create trigger prevent_system_role_delete
  before delete on roles
  for each row execute function fn_prevent_system_role_delete();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table roles enable row level security;
alter table permission_modules enable row level security;
alter table permission_actions enable row level security;
alter table role_permissions enable row level security;
alter table user_permission_overrides enable row level security;
alter table profiles enable row level security;

-- Static catalogs: any authenticated user can read, nobody mutates via the
-- client (only future migrations change these).
create policy permission_modules_select on permission_modules
  for select using (auth.role() = 'authenticated');
create policy permission_actions_select on permission_actions
  for select using (auth.role() = 'authenticated');

create policy roles_select on roles
  for select using (auth.role() = 'authenticated');
create policy roles_mutate on roles
  for all using (fn_has_permission(auth.uid(), 'roles', 'edit'))
  with check (fn_has_permission(auth.uid(), 'roles', 'edit'));

create policy role_permissions_select on role_permissions
  for select using (fn_has_permission(auth.uid(), 'roles', 'view'));
create policy role_permissions_mutate on role_permissions
  for all using (fn_has_permission(auth.uid(), 'roles', 'edit'))
  with check (fn_has_permission(auth.uid(), 'roles', 'edit'));

create policy user_permission_overrides_select on user_permission_overrides
  for select using (user_id = auth.uid() or fn_has_permission(auth.uid(), 'users', 'view'));
create policy user_permission_overrides_mutate on user_permission_overrides
  for all using (fn_has_permission(auth.uid(), 'users', 'edit'))
  with check (fn_has_permission(auth.uid(), 'users', 'edit'));

create policy profiles_select on profiles
  for select using (id = auth.uid() or fn_has_permission(auth.uid(), 'users', 'view'));
create policy profiles_update on profiles
  for update
  using (id = auth.uid() or fn_has_permission(auth.uid(), 'users', 'edit'))
  with check (id = auth.uid() or fn_has_permission(auth.uid(), 'users', 'edit'));
-- No insert policy: profiles are only created by the handle_new_user trigger
-- (security definer). No delete policy: deactivate via is_active instead.

-- Now that fn_has_permission exists, add the read policy for the audit log
-- (writes remain trigger-only, see audit_log migration).
create policy audit_log_select on audit_log
  for select using (fn_has_permission(auth.uid(), 'audit_log', 'view'));

-- ---------------------------------------------------------------------------
-- Audit trail on every mutable table in this migration.
-- ---------------------------------------------------------------------------

create trigger audit_profiles
  after insert or update or delete on profiles
  for each row execute function fn_audit_row();
create trigger audit_roles
  after insert or update or delete on roles
  for each row execute function fn_audit_row();
create trigger audit_role_permissions
  after insert or update or delete on role_permissions
  for each row execute function fn_audit_row();
create trigger audit_user_permission_overrides
  after insert or update or delete on user_permission_overrides
  for each row execute function fn_audit_row();
