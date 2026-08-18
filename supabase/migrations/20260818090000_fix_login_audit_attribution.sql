-- Successful sign-in resets profiles.failed_login_count/locked_until, and a
-- completed password reset clears password_reset_required. Both writes go
-- through the service-role client on purpose -- fn_guard_profile_security_
-- fields (20260814090000_username_login_lockout.sql) blocks a user from
-- changing these security fields on their own row via auth.uid(), and by
-- this point the user IS authenticated as themselves, so the regular client
-- would get rejected.
--
-- The side effect: the service-role client has no auth.uid(), so
-- fn_audit_row fell back to changed_by = null ("System" in the Audit Log
-- UI) for every single login, even though we know exactly who it was --
-- p_user_id is right there. Wrapping each write in its own security-definer
-- function lets it set app.current_user_id (transaction-scoped) immediately
-- before the write, the same attribution escape hatch fn_audit_row has
-- always supported but that nothing actually used yet.
create function fn_reset_login_lockout(p_user_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.current_user_id', p_user_id::text, true);

  update profiles
  set failed_login_count = 0,
      locked_until = null
  where id = p_user_id;
end;
$$;

grant execute on function fn_reset_login_lockout(uuid) to service_role;

create function fn_clear_password_reset_required(p_user_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.current_user_id', p_user_id::text, true);

  update profiles
  set password_reset_required = false
  where id = p_user_id;
end;
$$;

grant execute on function fn_clear_password_reset_required(uuid) to service_role;
