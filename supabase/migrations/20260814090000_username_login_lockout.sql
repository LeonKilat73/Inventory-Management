-- Username-or-email sign-in, plus a failed-login lockout ladder:
--   5 fails -> temporary 5-minute lock (auto-clears on timeout)
--   7 fails, cumulative (the temporary lock does not reset the counter) ->
--     suspended; requires the user to reset their password, then a
--     manager/admin to reactivate the account (see fn_register_failed_login
--     below and the app-level unsuspendUser action).

alter table profiles
  add column username text,
  add column failed_login_count integer not null default 0,
  add column locked_until timestamptz,
  add column is_suspended boolean not null default false,
  add column password_reset_required boolean not null default false;

alter table profiles
  add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_.]{3,32}$');

create unique index profiles_username_key on profiles (username) where username is not null;

-- Atomically registers one failed sign-in against an already-resolved
-- account and applies the lockout ladder described above. Called from the
-- login server action via the service-role client (auth.uid() is null at
-- that point -- the user isn't authenticated yet), so this never runs
-- through end-user RLS.
create or replace function fn_register_failed_login(p_user_id uuid)
returns table(out_failed_login_count integer, out_locked_until timestamptz, out_is_suspended boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update profiles
  set failed_login_count = failed_login_count + 1,
      locked_until = case
        when failed_login_count + 1 = 5 then now() + interval '5 minutes'
        else locked_until
      end,
      is_suspended = case
        when failed_login_count + 1 >= 7 then true
        else is_suspended
      end,
      password_reset_required = case
        when failed_login_count + 1 >= 7 then true
        else password_reset_required
      end
  where id = p_user_id
  returning failed_login_count, locked_until, is_suspended;
end;
$$;

grant execute on function fn_register_failed_login(uuid) to service_role;

-- profiles_update's RLS lets a user update their own row (for things like
-- notification preferences), which would otherwise let a locked-out user
-- simply PATCH their own suspension away over the REST API. Block that
-- specifically -- same "ask another admin" philosophy as the existing
-- guard_profile_role_change trigger. Writes from the service-role client
-- (fn_register_failed_login above, and the login action's own-reset-on-
-- success update) carry no end-user JWT, so auth.uid() is null there and
-- this guard doesn't apply to them.
create function fn_guard_profile_security_fields() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and (
    new.is_suspended is distinct from old.is_suspended or
    new.locked_until is distinct from old.locked_until or
    new.failed_login_count is distinct from old.failed_login_count or
    new.password_reset_required is distinct from old.password_reset_required
  ) then
    raise exception 'You cannot change your own account security status.';
  end if;
  return new;
end;
$$;

create trigger guard_profile_security_fields
  before update on profiles
  for each row execute function fn_guard_profile_security_fields();
