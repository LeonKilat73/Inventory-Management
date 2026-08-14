import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { markNotificationRead, markAllNotificationsRead } from "@/actions/notifications";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const TYPE_TONE = {
  low_stock: "error",
  item_modified: "secondary",
  po_status: "primary",
  defective_item: "tertiary",
  system: "neutral",
} as const;

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, type, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const hasUnread = (notifications ?? []).some((n) => !n.is_read);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-on-surface">Notifications</h1>
          <p className="text-sm text-on-surface-variant">
            Low stock alerts, item changes, purchase order updates, and defective item reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/users/${user.id}`}
            className="text-sm text-primary underline underline-offset-2"
          >
            Preferences
          </Link>
          {hasUnread && (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="text">
                Mark all as read
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {notifications?.map((n) => (
          <Card key={n.id} className={n.is_read ? "" : "border-primary/40"}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={TYPE_TONE[n.type as keyof typeof TYPE_TONE]}>
                    {n.type.replace(/_/g, " ")}
                  </Badge>
                  {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
                <p className="mt-1.5 font-medium text-on-surface">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-on-surface-variant">{n.body}</p>}
                <p className="mt-1.5 text-xs text-on-surface-variant">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              {!n.is_read && (
                <form action={markNotificationRead.bind(null, n.id)}>
                  <button type="submit" className="text-sm text-primary underline underline-offset-2">
                    Mark read
                  </button>
                </form>
              )}
            </div>
          </Card>
        ))}
        {!notifications?.length && (
          <p className="text-sm text-on-surface-variant">No notifications yet.</p>
        )}
      </div>
    </div>
  );
}
