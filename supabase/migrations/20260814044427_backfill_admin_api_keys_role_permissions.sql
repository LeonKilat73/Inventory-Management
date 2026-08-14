-- The api_keys module was added after the Phase 1 migration's one-time
-- cross-join that gave admin a role_permissions row for every module (so
-- the admin section of /admin/roles and the "Default (X)" labels on
-- /admin/users/[id] display correctly -- fn_has_permission itself already
-- hardcodes admin to always-allow regardless of these rows, so this is a
-- display-only backfill, not a functional permission change).
insert into role_permissions (role_id, module, action, allowed)
select r.id, 'api_keys', a.action, true
from roles r
cross join permission_actions a
where r.name = 'admin'
on conflict (role_id, module, action) do nothing;
