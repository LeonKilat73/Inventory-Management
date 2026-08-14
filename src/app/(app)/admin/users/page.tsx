import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { InviteUserForm } from "./_components/InviteUserForm";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  roles: { name: string } | { name: string }[] | null;
};

export default async function AdminUsersPage() {
  const permissions = await getPermissions();
  if (permissions.users?.view !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view users.
      </p>
    );
  }

  const supabase = await createClient();
  const [{ data: users }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, is_active, roles(name)")
      .order("full_name")
      .returns<UserRow[]>(),
    supabase.from("roles").select("id, name").order("name"),
  ]);

  const canEdit = permissions.users?.edit === true;
  const canCreate = permissions.users?.create === true;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">Users</h1>
        <p className="text-sm text-on-surface-variant">
          Assign roles and, per user, override individual module permissions.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => {
              const role = Array.isArray(u.roles) ? u.roles[0] : u.roles;
              return (
                <tr
                  key={u.id}
                  className="border-t border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low"
                >
                  <td className="px-4 py-3">{u.full_name}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone="primary">{role?.name ?? "—"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.is_active ? "tertiary" : "neutral"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-primary underline underline-offset-2"
                      >
                        Manage
                      </Link>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <Card className="max-w-xl">
          <h2 className="mb-4 text-lg font-medium text-on-surface">Invite a user</h2>
          <InviteUserForm roles={roles ?? []} />
        </Card>
      )}
    </div>
  );
}
