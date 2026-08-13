import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";

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
    return <p className="text-sm text-zinc-500">You don&apos;t have permission to view users.</p>;
  }

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active, roles(name)")
    .order("full_name")
    .returns<UserRow[]>();

  const canEdit = permissions.users?.edit === true;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Users</h1>
        <p className="text-sm text-zinc-500">
          Assign roles and, per user, override individual module permissions.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              {canEdit && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => {
              const role = Array.isArray(u.roles) ? u.roles[0] : u.roles;
              return (
                <tr key={u.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-4 py-2">{u.full_name}</td>
                  <td className="px-4 py-2 text-zinc-500">{u.email}</td>
                  <td className="px-4 py-2 capitalize">{role?.name ?? "—"}</td>
                  <td className="px-4 py-2">{u.is_active ? "Active" : "Inactive"}</td>
                  {canEdit && (
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-zinc-500 underline underline-offset-2 hover:text-foreground"
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
    </div>
  );
}
