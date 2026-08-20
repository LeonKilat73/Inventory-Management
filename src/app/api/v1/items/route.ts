import type { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";

type Constituent = { itemId: string; sku: string; name: string; quantity: number };

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if ("error" in auth) return auth.error;

  const sku = request.nextUrl.searchParams.get("sku");

  // Deliberately no unit_cost here -- this endpoint is what POS's catalog,
  // checkout, and quote pages fetch and pass straight into client
  // components, so anything selected here is visible in the browser's page
  // payload/devtools even if the UI never renders it. Cost is margin data;
  // it has no legitimate reason to leave the server on a customer-facing
  // sale integration. If a future integration genuinely needs cost, give it
  // its own scoped endpoint rather than adding the field back here.
  let query = auth.supabase
    .from("items")
    .select(
      "id, sku, name, description, unit_price, is_bundle, is_active, reorder_threshold, allow_backorder, categories(name)",
    )
    .eq("is_active", true)
    .order("name");

  if (sku) query = query.eq("sku", sku);

  const { data: items, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const [{ data: stockLevels }, { data: bundleStock }, { data: bundleItems }] = await Promise.all([
    auth.supabase.from("item_stock_levels").select("item_id, current_stock"),
    auth.supabase.from("bundle_stock_levels").select("bundle_id, available"),
    auth.supabase.from("bundle_items").select("bundle_id, quantity, items(id, sku, name)"),
  ]);

  const stockByItemId = new Map((stockLevels ?? []).map((s) => [s.item_id, s.current_stock]));
  const bundleStockById = new Map((bundleStock ?? []).map((b) => [b.bundle_id, b.available]));

  const constituentsByBundleId = new Map<string, Constituent[]>();
  for (const bi of bundleItems ?? []) {
    const constituentItem = Array.isArray(bi.items) ? bi.items[0] : bi.items;
    if (!constituentItem) continue;
    const list = constituentsByBundleId.get(bi.bundle_id) ?? [];
    list.push({
      itemId: constituentItem.id,
      sku: constituentItem.sku,
      name: constituentItem.name,
      quantity: bi.quantity,
    });
    constituentsByBundleId.set(bi.bundle_id, list);
  }

  const result = items.map((item) => {
    const category = Array.isArray(item.categories) ? item.categories[0] : item.categories;
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: category?.name ?? null,
      unitPrice: item.unit_price,
      isBundle: item.is_bundle,
      stock: item.is_bundle ? bundleStockById.get(item.id) ?? 0 : stockByItemId.get(item.id) ?? 0,
      reorderThreshold: item.reorder_threshold,
      allowBackorder: item.allow_backorder,
      ...(item.is_bundle ? { constituents: constituentsByBundleId.get(item.id) ?? [] } : {}),
    };
  });

  return Response.json({ items: result });
}
