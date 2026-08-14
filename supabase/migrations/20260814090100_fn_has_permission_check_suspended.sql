-- The lockout ladder's suspension is otherwise only enforced by the login
-- server action, which is bypassable by anyone who still knows their own
-- correct password and calls Supabase Auth's token endpoint directly
-- (GoTrue has no concept of "suspended"). Closing it here instead -- the
-- same way is_active already works -- means a suspended account has zero
-- permissions everywhere the moment it's suspended, session or no session,
-- not just at the /login form.
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
  where p.id = p_user and p.is_active and not p.is_suspended;

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
