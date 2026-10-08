-- Security fix. Postgres lets everyone (PUBLIC) execute a function unless that
-- is revoked, and Supabase also grants execute on new functions to the anon
-- and authenticated roles. The anon key ships in the website's JavaScript, so
-- every function below was callable by anyone, without logging in, straight
-- from the REST API:
--
--   fn_record_pos_sale / fn_void_pos_sale / fn_partial_return_pos_sale
--     -> fabricate, void or return sales and move stock (item ids were also
--        publicly listable through the item_stock_levels view)
--   fn_register_failed_login / fn_reset_login_lockout /
--   fn_clear_password_reset_required
--     -> lock out or suspend any account whose id is known, reset the
--        brute-force counter, or clear the password-reset requirement
--
-- All of these are only ever called from the server with the service-role
-- key (the POS sales API and the login actions), which keeps working: it is
-- granted explicitly below. Signed-in users never call them directly.

revoke execute on function fn_record_pos_sale(jsonb, uuid, text) from public, anon, authenticated;
revoke execute on function fn_void_pos_sale(uuid) from public, anon, authenticated;
revoke execute on function fn_partial_return_pos_sale(uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function fn_register_failed_login(uuid) from public, anon, authenticated;
revoke execute on function fn_reset_login_lockout(uuid) from public, anon, authenticated;
revoke execute on function fn_clear_password_reset_required(uuid) from public, anon, authenticated;

grant execute on function fn_record_pos_sale(jsonb, uuid, text) to service_role;
grant execute on function fn_void_pos_sale(uuid) to service_role;
grant execute on function fn_partial_return_pos_sale(uuid, jsonb, text) to service_role;
grant execute on function fn_register_failed_login(uuid) to service_role;
grant execute on function fn_reset_login_lockout(uuid) to service_role;
grant execute on function fn_clear_password_reset_required(uuid) to service_role;

-- The app only reads a signed-in user's own permissions with this; there is
-- no reason for a visitor who isn't logged in to ask for anyone's.
revoke execute on function resolve_user_permissions(uuid) from public, anon;
grant execute on function resolve_user_permissions(uuid) to authenticated, service_role;

-- These views run with their owner's rights (so they see every row), and
-- anon could select from them: every item id and its stock level, no login.
revoke select on item_stock_levels from anon;
revoke select on bundle_stock_levels from anon;
