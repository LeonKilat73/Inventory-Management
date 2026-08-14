-- Manual admin/manager controls on top of the automatic lockout ladder:
--   admin_locked  -- an explicit lock a manager/admin flips on/off at will,
--                    independent of the failed-login ladder (no password
--                    reset required to clear it, unlike is_suspended).
--   is_active     -- already existed (soft-delete: fn_has_permission already
--                    gated on it), just wiring an actual UI toggle to it now.

alter table profiles
  add column admin_locked boolean not null default false;

-- fn_has_permission already checked is_active; now also blocks admin_locked
-- the same way, so a locked-but-somehow-still-authenticated session has zero
-- permissions everywhere (see 20260814090100 for why this matters -- GoTrue
-- itself has no concept of any of these flags).
create or replace function fn_has_permission(p_user uuid, p_module text, p_action text)
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
  where p.id = p_user and p.is_active and not p.is_suspended and not p.admin_locked;

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

-- Extends the existing self-update guard (20260814090000) to also cover
-- admin_locked and is_active -- is_active was never actually covered before,
-- meaning a deactivated user with a lingering session could have PATCHed
-- their own row back to is_active=true over the REST API the same way a
-- suspended user could have self-unsuspended before that migration's fix.
create or replace function fn_guard_profile_security_fields() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and (
    new.is_suspended is distinct from old.is_suspended or
    new.locked_until is distinct from old.locked_until or
    new.failed_login_count is distinct from old.failed_login_count or
    new.password_reset_required is distinct from old.password_reset_required or
    new.admin_locked is distinct from old.admin_locked or
    new.is_active is distinct from old.is_active
  ) then
    raise exception 'You cannot change your own account security status.';
  end if;
  return new;
end;
$$;
