import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { RolePermissionForm } from "./_components/RolePermissionForm";

export default async function AdminRolesPage() {
  const permissions = await getPermissions();
  if (permissions.roles?.view !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view roles.
      </p>
    );
  }

  const supabase = await createClient();
  const [{ data: roles }, { data: rolePermissions }] = await Promise.all([
    supabase.from("roles").select("id, name, is_system").order("name"),
    supabase.from("role_permissions").select("role_id, module, action, allowed"),
  ]);

  const defaultsByRole: Record<string, Record<string, Record<string, boolean>>> = {};
  for (const rp of rolePermissions ?? []) {
    defaultsByRole[rp.role_id] ??= {};
    defaultsByRole[rp.role_id][rp.module] ??= {};
    defaultsByRole[rp.role_id][rp.module][rp.action] = rp.allowed;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">Roles</h1>
        <p className="text-sm text-on-surface-variant">
          Default permissions per role. Individual users can still be granted or
          revoked specific actions from their user page.
        </p>
      </div>

      <div className="space-y-4">
        {roles?.map((role) => (
          <RolePermissionForm
            key={role.id}
            roleId={role.id}
            roleName={role.name}
            defaults={defaultsByRole[role.id] ?? {}}
            readOnly={role.is_system}
          />
        ))}
      </div>
    </div>
  );
}
