import type { NextRequest } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

const PERIOD_DAYS: Record<string, number | null> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
  all: null,
};

type ItemRow = { id: string; sku: string; name: string; unit_price: number | null; is_active: boolean };

// One row per active item for the selected period (units sold + estimated
// revenue), sorted best-to-worst -- the same underlying numbers as the
// Reports page's best-sellers/slow-movers split, just as a single sortable
// sheet instead of two capped on-screen lists.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await hasPermission("stock_movements", "view"))) return new Response("Forbidden", { status: 403 });

  const periodParam = request.nextUrl.searchParams.get("period") ?? "month";
  const days = periodParam in PERIOD_DAYS ? PERIOD_DAYS[periodParam] : PERIOD_DAYS.month;
  const since = days ? new Date(new Date().getTime() - days * 86400000).toISOString() : null;

  const supabase = await createClient();
  let movementsQuery = supabase
    .from("stock_movements")
    .select("item_id, quantity_delta")
    .eq("movement_type", "sale")
    .limit(50000);
  if (since) movementsQuery = movementsQuery.gte("created_at", since);

  const [{ data: movements }, { data: items }] = await Promise.all([
    movementsQuery,
    supabase
      .from("items")
      .select("id, sku, name, unit_price, is_active")
      .eq("is_bundle", false)
      .eq("is_active", true)
      .returns<ItemRow[]>(),
  ]);

  const soldByItem = new Map<string, number>();
  for (const m of movements ?? []) {
    soldByItem.set(m.item_id, (soldByItem.get(m.item_id) ?? 0) + Math.abs(m.quantity_delta));
  }

  const rows = (items ?? [])
    .map((item) => {
      const units = soldByItem.get(item.id) ?? 0;
      return {
        sku: item.sku,
        name: item.name,
        unitsSold: units,
        estRevenue: (units * Number(item.unit_price ?? 0)).toFixed(2),
      };
    })
    .sort((a, b) => b.unitsSold - a.unitsSold);

  const csv = toCsv(rows, [
    { key: "sku", header: "SKU" },
    { key: "name", header: "Name" },
    { key: "unitsSold", header: "Units Sold" },
    { key: "estRevenue", header: "Estimated Revenue" },
  ]);

  return csvResponse(csv, `sales-report-${periodParam}-${new Date().toISOString().slice(0, 10)}.csv`);
}
