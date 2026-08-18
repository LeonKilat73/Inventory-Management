import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const PERIODS = {
  week: { label: "This week", days: 7 },
  month: { label: "This month", days: 30 },
  quarter: { label: "This quarter", days: 90 },
  year: { label: "This year", days: 365 },
  all: { label: "All time", days: null },
} as const;
type PeriodKey = keyof typeof PERIODS;

type ItemRow = {
  id: string;
  sku: string;
  name: string;
  unit_price: number | null;
  is_active: boolean;
};

// Best-sellers/slow-movers are computed here from the same stock_movements
// ledger everything else in this app already trusts, not from a separate
// sales table -- 'sale' movements are the ledger's own record of what left
// the shelf as a paying sale (POS-driven and manually-entered alike),
// already excluding replacements/adjustments/bundle assembly by movement
// type. Aggregated in JS from a capped fetch, matching this codebase's
// established reporting pattern (see the POS Analytics dashboard) rather
// than a SQL aggregate view.
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period: PeriodKey = periodParam && periodParam in PERIODS ? (periodParam as PeriodKey) : "month";

  const permissions = await getPermissions();
  if (permissions.stock_movements?.view !== true) {
    return <p className="text-sm text-on-surface-variant">You don&apos;t have permission to view reports.</p>;
  }

  const supabase = await createClient();
  const { days } = PERIODS[period];
  const now = new Date();
  const since = days ? new Date(now.getTime() - days * 86400000).toISOString() : null;

  let movementsQuery = supabase
    .from("stock_movements")
    .select("item_id, quantity_delta, created_at")
    .eq("movement_type", "sale")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (since) movementsQuery = movementsQuery.gte("created_at", since);

  const [{ data: movements }, { data: items }] = await Promise.all([
    movementsQuery,
    supabase
      .from("items")
      .select("id, sku, name, unit_price, is_active")
      .eq("is_bundle", false)
      .returns<ItemRow[]>(),
  ]);

  const itemById = new Map((items ?? []).map((i) => [i.id, i]));

  const soldByItem = new Map<string, number>();
  for (const m of movements ?? []) {
    soldByItem.set(m.item_id, (soldByItem.get(m.item_id) ?? 0) + Math.abs(m.quantity_delta));
  }

  const bestSellers = [...soldByItem.entries()]
    .map(([itemId, units]) => {
      const item = itemById.get(itemId);
      return {
        itemId,
        units,
        name: item?.name ?? "Deleted item",
        sku: item?.sku ?? "—",
        revenue: units * Number(item?.unit_price ?? 0),
      };
    })
    .sort((a, b) => b.units - a.units)
    .slice(0, 15);

  const totalRevenue = bestSellers.reduce((sum, r) => sum + r.revenue, 0);
  const totalUnits = bestSellers.reduce((sum, r) => sum + r.units, 0);

  const slowMovers = (items ?? [])
    .filter((item) => item.is_active && !soldByItem.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-on-surface">Reports</h1>
          <p className="text-sm text-on-surface-variant">
            What&apos;s actually moving, and what&apos;s sitting on the shelf.
          </p>
        </div>
        <a
          href={`/api/export/reports?period=${period}`}
          className="shrink-0 text-sm text-primary underline underline-offset-2"
        >
          Export CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
          <Link
            key={key}
            href={`/reports?period=${key}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              period === key ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {PERIODS[key].label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-on-surface-variant">Units sold</p>
          <p className="mt-1 text-2xl font-medium text-on-surface">{totalUnits}</p>
        </Card>
        <Card>
          <p className="text-sm text-on-surface-variant">Estimated revenue</p>
          <p className="mt-1 text-2xl font-medium text-on-surface">₱{totalRevenue.toFixed(2)}</p>
        </Card>
        <Card className="hidden sm:block">
          <p className="text-sm text-on-surface-variant">No sales this period</p>
          <p className="mt-1 text-2xl font-medium text-on-surface">{slowMovers.length}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 font-medium text-on-surface">Best sellers</h2>
        <p className="mb-4 text-xs text-on-surface-variant">
          Estimated revenue uses each item&apos;s current price, not the price at the time of sale.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-on-surface-variant">
              <tr>
                <th className="pb-2 pr-4 font-medium">Item</th>
                <th className="pb-2 pr-4 font-medium">SKU</th>
                <th className="pb-2 pr-4 font-medium">Units sold</th>
                <th className="pb-2 font-medium">Est. revenue</th>
              </tr>
            </thead>
            <tbody>
              {bestSellers.map((row, i) => (
                <tr key={row.itemId} className="border-t border-outline-variant/60">
                  <td className="py-2 pr-4 text-on-surface">
                    {i < 3 && <Badge tone="primary" className="mr-2">#{i + 1}</Badge>}
                    {row.name}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-on-surface-variant">{row.sku}</td>
                  <td className="py-2 pr-4 text-on-surface">{row.units}</td>
                  <td className="py-2 text-on-surface">₱{row.revenue.toFixed(2)}</td>
                </tr>
              ))}
              {!bestSellers.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                    No sales recorded in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-medium text-on-surface">Slow movers</h2>
        <p className="mb-4 text-xs text-on-surface-variant">
          Active items with zero recorded sales in the selected period.
        </p>
        <div className="flex flex-wrap gap-2">
          {slowMovers.map((item) => (
            <Badge key={item.id} tone="neutral">
              {item.name} ({item.sku})
            </Badge>
          ))}
          {!slowMovers.length && <p className="text-sm text-on-surface-variant">Everything active has sold.</p>}
        </div>
      </Card>
    </div>
  );
}
