import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getPermissions } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

function daysAgo(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function StatCard({ label, value, href }: { label: string; value: string | number; href: string }) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="mt-1 text-2xl font-medium text-on-surface">{value}</p>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [user, permissions] = await Promise.all([getCurrentUser(), getPermissions()]);

  const canViewItems = permissions.items?.view === true;
  const canViewPO = permissions.purchase_orders?.view === true;
  const canViewDefective = permissions.defective_items?.view === true;
  const canViewExpenses = permissions.expenses?.view === true;
  const canViewCalendar = permissions.calendar?.view === true;
  const canViewStock = permissions.stock_movements?.view === true;

  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [itemsRes, stockLevelsRes, poCountRes, defectiveRes, expensesRes, calendarRes, movementsRes] =
    await Promise.all([
      canViewItems
        ? supabase.from("items").select("id, name, sku, reorder_threshold").eq("is_bundle", false).eq("is_active", true)
        : Promise.resolve({ data: null }),
      canViewItems ? supabase.from("item_stock_levels").select("item_id, current_stock") : Promise.resolve({ data: null }),
      canViewPO
        ? supabase.from("purchase_orders").select("id", { count: "exact", head: true }).in("status", ["submitted", "partially_received"])
        : Promise.resolve({ count: null }),
      canViewDefective
        ? supabase
            .from("defective_items")
            .select("id, quantity, created_at, items(name, sku)", { count: "exact" })
            .eq("status", "pending")
            .order("created_at", { ascending: true })
            .limit(6)
        : Promise.resolve({ data: null, count: null }),
      canViewExpenses ? supabase.from("expenses").select("amount").gte("incurred_at", startOfMonth) : Promise.resolve({ data: null }),
      canViewCalendar
        ? supabase
            .from("calendar_events")
            .select("id, title, event_type, starts_at")
            .gte("starts_at", now.toISOString())
            .order("starts_at", { ascending: true })
            .limit(5)
        : Promise.resolve({ data: null }),
      canViewStock
        ? supabase
            .from("stock_movements")
            .select("id, quantity_delta, movement_type, created_at, items(name, sku)")
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: null }),
    ]);

  const stockByItemId = new Map((stockLevelsRes.data ?? []).map((s) => [s.item_id, s.current_stock]));
  const lowStockItems = (itemsRes.data ?? [])
    .map((item) => ({ ...item, stock: stockByItemId.get(item.id) ?? 0 }))
    .filter((item) => item.stock <= item.reorder_threshold)
    .sort((a, b) => a.stock - b.stock);

  const expensesThisMonth = (expensesRes.data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">Welcome, {user?.fullName ?? "there"}</h1>
        <p className="text-sm text-on-surface-variant">
          Signed in as <Badge tone="primary">{user?.roleName}</Badge>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {canViewItems && <StatCard label="Items needing reorder" value={lowStockItems.length} href="/items" />}
        {canViewPO && <StatCard label="Purchase orders awaiting action" value={poCountRes.count ?? 0} href="/purchase-orders" />}
        {canViewDefective && <StatCard label="Pending defective reports" value={defectiveRes.count ?? 0} href="/stock/defective" />}
        {canViewExpenses && <StatCard label="Expenses this month" value={`₱${expensesThisMonth.toFixed(2)}`} href="/expenses" />}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {canViewItems && (
          <Card>
            <h2 className="mb-3 font-medium text-on-surface">Low stock</h2>
            <div className="space-y-2">
              {lowStockItems.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-on-surface">{item.name}</span>
                  <Badge tone="error">
                    {item.stock} / {item.reorder_threshold}
                  </Badge>
                </div>
              ))}
              {!lowStockItems.length && <p className="text-sm text-on-surface-variant">All stocked up.</p>}
            </div>
          </Card>
        )}

        {canViewDefective && (
          <Card>
            <h2 className="mb-3 font-medium text-on-surface">Defective reports</h2>
            <div className="space-y-2">
              {(defectiveRes.data ?? []).map((d) => {
                const item = Array.isArray(d.items) ? d.items[0] : d.items;
                return (
                  <div key={d.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface">
                        {d.quantity} × {item?.name}
                      </span>
                      <span className="text-xs text-on-surface-variant">{daysAgo(d.created_at)}</span>
                    </div>
                  </div>
                );
              })}
              {!defectiveRes.data?.length && <p className="text-sm text-on-surface-variant">Nothing pending.</p>}
            </div>
          </Card>
        )}

        {canViewCalendar && (
          <Card>
            <h2 className="mb-3 font-medium text-on-surface">Upcoming</h2>
            <div className="space-y-2">
              {(calendarRes.data ?? []).map((e) => (
                <div key={e.id} className="text-sm">
                  <p className="text-on-surface">{e.title}</p>
                  <p className="text-xs text-on-surface-variant">
                    {new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
                    {e.event_type.replace(/_/g, " ")}
                  </p>
                </div>
              ))}
              {!calendarRes.data?.length && <p className="text-sm text-on-surface-variant">Nothing scheduled.</p>}
            </div>
          </Card>
        )}
      </div>

      {canViewStock && (
        <Card>
          <h2 className="mb-3 font-medium text-on-surface">Recent activity</h2>
          <div className="space-y-2">
            {(movementsRes.data ?? []).map((m) => {
              const item = Array.isArray(m.items) ? m.items[0] : m.items;
              return (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{m.movement_type.replace(/_/g, " ")}</Badge>
                    <span className="text-on-surface">{item?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={m.quantity_delta >= 0 ? "text-primary" : "text-error"}>
                      {m.quantity_delta >= 0 ? "+" : ""}
                      {m.quantity_delta}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              );
            })}
            {!movementsRes.data?.length && <p className="text-sm text-on-surface-variant">No activity yet.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
