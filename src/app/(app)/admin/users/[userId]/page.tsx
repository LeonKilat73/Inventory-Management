import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getPermissions } from "@/lib/auth/permissions";
import { RoleForm } from "../_components/RoleForm";
import { OverrideGrid } from "../_components/OverrideGrid";
import { NotificationPreferencesForm } from "../_components/NotificationPreferencesForm";
import { UsernameForm } from "../_components/UsernameForm";
import { SecurityStatusCard } from "../_components/SecurityStatusCard";
import { Card } from "@/components/ui/Card";
import { BackLink } from "@/components/ui/BackLink";

export default async function ManageUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const permissions = await getPermissions();
  const actingUser = await getCurrentUser();
  const isSelf = actingUser?.id === userId;

  if (permissions.users?.view !== true && !isSelf) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view users.
      </p>
    );
  }

  const supabase = await createClient();

  const [{ data: profile }, { data: roles }, { data: rolePermissions }, { data: overrideRows }, { data: notifPrefs }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, role_id, username, failed_login_count, locked_until, is_suspended, password_reset_required",
        )
        .eq("id", userId)
        .single(),
      supabase.from("roles").select("id, name").order("name"),
      supabase.from("role_permissions").select("role_id, module, action, allowed"),
      supabase.from("user_permission_overrides").select("module, action, allowed").eq("user_id", userId),
      supabase
        .from("notification_preferences")
        .select("email_enabled, low_stock_alerts, item_modified_alerts")
        .eq("user_id", userId)
        .single(),
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
  const canEditPreferences = canEdit || isSelf;
  const canViewUsersList = permissions.users?.view === true;

  return (
    <div className="max-w-4xl space-y-8">
      <BackLink
        href={canViewUsersList ? "/admin/users" : "/notifications"}
        label={canViewUsersList ? "Users" : "Notifications"}
      />

      <div>
        <h1 className="text-2xl font-medium text-on-surface">{profile.full_name}</h1>
        <p className="text-sm text-on-surface-variant">
          {profile.email}
          {profile.username && <> · @{profile.username}</>}
        </p>
      </div>

      {canEdit && (
        <Card>
          <h2 className="mb-3 text-lg font-medium text-on-surface">Sign-in security</h2>
          <SecurityStatusCard
            userId={profile.id}
            failedLoginCount={profile.failed_login_count}
            lockedUntil={profile.locked_until}
            isSuspended={profile.is_suspended}
            passwordResetRequired={profile.password_reset_required}
          />
        </Card>
      )}

      {canEdit && (
        <Card className="max-w-sm">
          <h2 className="mb-3 text-lg font-medium text-on-surface">Username</h2>
          <UsernameForm userId={profile.id} username={profile.username} />
        </Card>
      )}

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

      {canEdit && (
        <div>
          <h2 className="mb-1 text-lg font-medium text-on-surface">Permission overrides</h2>
          <p className="mb-4 text-sm text-on-surface-variant">
            Grant or revoke individual module actions on top of this user&apos;s role default.
          </p>
          <OverrideGrid userId={profile.id} roleDefaults={roleDefaults} overrides={overrides} />
        </div>
      )}

      {canEditPreferences && notifPrefs && (
        <Card className="max-w-sm">
          <h2 className="mb-3 text-lg font-medium text-on-surface">Notification preferences</h2>
          <NotificationPreferencesForm
            userId={profile.id}
            emailEnabled={notifPrefs.email_enabled}
            lowStockAlerts={notifPrefs.low_stock_alerts}
            itemModifiedAlerts={notifPrefs.item_modified_alerts}
          />
        </Card>
      )}
    </div>
  );
}
