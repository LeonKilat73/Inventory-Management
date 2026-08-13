import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getPermissions } from "@/lib/auth/permissions";
import { RoleForm } from "../_components/RoleForm";
import { OverrideGrid } from "../_components/OverrideGrid";
import { Card } from "@/components/ui/Card";

export default async function ManageUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const permissions = await getPermissions();
  const actingUser = await getCurrentUser();

  if (permissions.users?.view !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view users.
      </p>
    );
  }

  const supabase = await createClient();

  const [{ data: profile }, { data: roles }, { data: rolePermissions }, { data: overrideRows }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, email, role_id").eq("id", userId).single(),
      supabase.from("roles").select("id, name").order("name"),
      supabase.from("role_permissions").select("role_id, module, action, allowed"),
      supabase.from("user_permission_overrides").select("module, action, allowed").eq("user_id", userId),
    ]);

  if (!profile) notFound();

  const roleDefaults: Record<string, Record<string, boolean>> = {};
  for (const rp of rolePermissions ?? []) {
    if (rp.role_id !== profile.role_id) continue;
    roleDefaults[rp.module] ??= {};
    roleDefaults[rp.module][rp.action] = rp.allowed;
  }

  const overrides: Record<string, Record<string, boolean>> = {};
  for (const o of overrideRows ?? []) {
    overrides[o.module] ??= {};
    overrides[o.module][o.action] = o.allowed;
  }

  const canEdit = permissions.users?.edit === true;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">{profile.full_name}</h1>
        <p className="text-sm text-on-surface-variant">{profile.email}</p>
      </div>

      {canEdit && (
        <Card>
          <RoleForm
            userId={profile.id}
            currentRoleId={profile.role_id}
            roles={roles ?? []}
            disabled={actingUser?.id === profile.id}
          />
        </Card>
      )}

      <div>
        <h2 className="mb-1 text-lg font-medium text-on-surface">Permission overrides</h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          Grant or revoke individual module actions on top of this user&apos;s role default.
        </p>
        {canEdit ? (
          <OverrideGrid userId={profile.id} roleDefaults={roleDefaults} overrides={overrides} />
        ) : (
          <p className="text-sm text-on-surface-variant">
            You don&apos;t have permission to edit overrides.
          </p>
        )}
      </div>
    </div>
  );
}
