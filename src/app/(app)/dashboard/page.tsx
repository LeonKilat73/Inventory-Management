import { getCurrentUser } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="text-2xl font-medium text-on-surface">
        Welcome, {user?.fullName ?? "there"}
      </h1>
      <Card className="mt-6 max-w-xl">
        <p className="text-sm text-on-surface-variant">
          Signed in as <Badge tone="primary">{user?.roleName}</Badge>
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          Use the sidebar to manage items, bundles, and (once you have the
          permission) users and roles.
        </p>
      </Card>
    </div>
  );
}
