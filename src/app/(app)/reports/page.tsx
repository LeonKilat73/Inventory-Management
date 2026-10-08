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

type CategoryRef = { name: string; parent: { name: string } | null } | null;

type ItemRow = {
  id: string;
  sku: string;
  name: string;
  unit_price: number | null;
  unit_cost: number | null;
  is_active: boolean;
  categories: CategoryRef;
};

// Slow movers only list items with units actually on the shelf -- an item
// with zero stock and zero sales isn't "slow", it just isn't stocked
// (made-to-order, never received). The top of the list is capped; everything
// else sits in collapsible per-category groups so the page stays scannable.
const SLOW_TOP_N = 15;

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });

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

  const [{ data: movements }, { data: items }, { data: stockLevels }, { data: salesNewestFirst }, { data: firstSaleRow }] =
    await Promise.all([
      movementsQuery,
      supabase
        .from("items")
        .select("id, sku, name, unit_price, unit_cost, is_active, categories(name, parent:parent_id(name))")
        .eq("is_bundle", false)
        .returns<ItemRow[]>(),
      supabase.from("item_stock_levels").select("item_id, current_stock"),
      // All-time, regardless of the selected period -- only used to show
      // when each slow item last sold, not to decide what counts as slow.
      supabase
        .from("stock_movements")
        .select("item_id, created_at")
        .eq("movement_type", "sale")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("stock_movements")
        .select("created_at")
        .eq("movement_type", "sale")
        .order("created_at", { ascending: true })
        .limit(1),
    ]);

  const itemById = new Map((items ?? []).map((i) => [i.id, i]));
  const stockById = new Map((stockLevels ?? []).map((s) => [s.item_id, s.current_stock as number]));
  const lastSoldById = new Map<string, string>();
  for (const m of salesNewestFirst ?? []) {
    if (!lastSoldById.has(m.item_id)) lastSoldById.set(m.item_id, m.created_at);
  }
  const firstSaleAt = firstSaleRow?.[0]?.created_at ?? null;

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
    .filter((item) => item.is_active && !soldByItem.has(item.id) && (stockById.get(item.id) ?? 0) > 0)
    .map((item) => {
      const stock = stockById.get(item.id) ?? 0;
      const category = Array.isArray(item.categories) ? item.categories[0] : item.categories;
      const parent = category ? (Array.isArray(category.parent) ? category.parent[0] : category.parent) : null;
      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        stock,
        stockCost: stock * Number(item.unit_cost ?? 0),
        lastSold: lastSoldById.get(item.id) ?? null,
        categoryLabel: category ? (parent ? `${parent.name}: ${category.name}` : category.name) : "Uncategorized",
        groupName: parent?.name ?? category?.name ?? "Uncategorized",
      };
    })
    .sort((a, b) => b.stockCost - a.stockCost || b.stock - a.stock || a.name.localeCompare(b.name));

  const slowUnits = slowMovers.reduce((sum, r) => sum + r.stock, 0);
  const slowCost = slowMovers.reduce((sum, r) => sum + r.stockCost, 0);
  const slowTop = slowMovers.slice(0, SLOW_TOP_N);

  const slowGroups = new Map<string, { items: typeof slowMovers; cost: number }>();
  for (const row of slowMovers) {
    const group = slowGroups.get(row.groupName) ?? { items: [], cost: 0 };
    group.items.push(row);
    group.cost += row.stockCost;
    slowGroups.set(row.groupName, group);
  }
  const slowGroupList = [...slowGroups.entries()].sort(
    (a, b) => b[1].cost - a[1].cost || b[1].items.length - a[1].items.length,
  );

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
          <p className="text-sm text-on-surface-variant">In stock, not selling</p>
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
        <p className="text-xs text-on-surface-variant">
          Active items with units on the shelf and no recorded sales in the selected period, largest stock cost first.
        </p>
        <p className="mb-4 mt-1 text-xs text-on-surface-variant">
          Only sales recorded in this system count
          {firstSaleAt ? `, and it has been recording since ${shortDate(firstSaleAt)}` : ""}. Sales rung up elsewhere
          (for example directly in QuickBooks) are not included, so treat this as a guide.
        </p>

        {slowMovers.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nothing in stock is sitting unsold.</p>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-on-surface">
              <span className="font-medium">{slowMovers.length.toLocaleString("en-PH")} items</span>
              <span className="text-on-surface-variant">
                {" "}· {slowUnits.toLocaleString("en-PH")} units ·{" "}
              </span>
              <span className="font-medium">{peso(slowCost)}</span>
              <span className="text-on-surface-variant"> of stock at cost</span>
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-on-surface-variant">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Item</th>
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 pr-4 text-right font-medium">On hand</th>
                    <th className="pb-2 pr-4 text-right font-medium">Stock cost</th>
                    <th className="pb-2 font-medium">Last sold</th>
                  </tr>
                </thead>
                <tbody>
                  {slowTop.map((row) => (
                    <tr key={row.id} className="border-t border-outline-variant/60">
                      <td className="py-2 pr-4">
                        <p className="text-on-surface">{row.name}</p>
                        <p className="font-mono text-xs text-on-surface-variant">{row.sku}</p>
                      </td>
                      <td className="py-2 pr-4 text-on-surface-variant">{row.categoryLabel}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-on-surface">{row.stock}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-on-surface">{peso(row.stockCost)}</td>
                      <td className="whitespace-nowrap py-2 text-on-surface-variant">
                        {row.lastSold ? shortDate(row.lastSold) : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {slowMovers.length > SLOW_TOP_N && (
              <details className="group rounded-xl border border-outline-variant/60">
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-primary">
                  See all {slowMovers.length.toLocaleString("en-PH")} items by category
                </summary>
                <div className="space-y-2 border-t border-outline-variant/60 p-3">
                  {slowGroupList.map(([groupName, group]) => (
                    <details key={groupName} className="rounded-lg bg-surface-container-low">
                      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-3 py-2 text-sm text-on-surface">
                        <span>
                          {groupName}{" "}
                          <span className="text-on-surface-variant">({group.items.length})</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-on-surface-variant">{peso(group.cost)}</span>
                      </summary>
                      <div className="overflow-x-auto px-3 pb-3">
                        <table className="w-full text-sm">
                          <tbody>
                            {group.items.map((row) => (
                              <tr key={row.id} className="border-t border-outline-variant/60">
                                <td className="py-1.5 pr-4 text-on-surface">
                                  {row.name}{" "}
                                  <span className="font-mono text-xs text-on-surface-variant">{row.sku}</span>
                                </td>
                                <td className="whitespace-nowrap py-1.5 pr-4 text-right tabular-nums text-on-surface">
                                  {row.stock} on hand
                                </td>
                                <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-on-surface-variant">
                                  {peso(row.stockCost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
