import { getCurrentUser } from "@/lib/auth/permissions";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">
        Welcome, {user?.fullName ?? "there"}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Signed in as {user?.roleName}. Use the sidebar to manage items,
        bundles, and (once you have the permission) users and roles.
      </p>
    </div>
  );
}
