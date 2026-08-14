import type { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if ("error" in auth) return auth.error;

  const { data: items, error } = await auth.supabase
    .from("items")
    .select(
      "id, sku, name, description, unit_price, unit_cost, is_bundle, is_active, reorder_threshold, categories(name)",
    )
    .eq("is_active", true)
    .order("name");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: stockLevels } = await auth.supabase.from("item_stock_levels").select("item_id, current_stock");
  const stockByItemId = new Map((stockLevels ?? []).map((s) => [s.item_id, s.current_stock]));

  const result = items.map((item) => {
    const category = Array.isArray(item.categories) ? item.categories[0] : item.categories;
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: category?.name ?? null,
      unitPrice: item.unit_price,
      unitCost: item.unit_cost,
      isBundle: item.is_bundle,
      stock: stockByItemId.get(item.id) ?? 0,
      reorderThreshold: item.reorder_threshold,
    };
  });

  return Response.json({ items: result });
}
