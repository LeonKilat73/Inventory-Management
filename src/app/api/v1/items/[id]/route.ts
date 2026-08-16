import type { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { getCurrentStock } from "@/lib/stock/ledger";

type Constituent = { itemId: string; sku: string; name: string; quantity: number };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  // See GET /api/v1/items for why unit_cost is deliberately never selected
  // here -- this is the same customer-facing sale integration (POS).
  const { data: item, error } = await auth.supabase
    .from("items")
    .select("id, sku, name, description, unit_price, is_bundle, is_active, reorder_threshold, categories(name)")
    .eq("id", id)
    .single();

  if (error || !item) return Response.json({ error: "Item not found." }, { status: 404 });

  const category = Array.isArray(item.categories) ? item.categories[0] : item.categories;

  let stock: number;
  let constituents: Constituent[] | undefined;

  if (item.is_bundle) {
    const [{ data: bundleStock }, { data: bundleItems }] = await Promise.all([
      auth.supabase.from("bundle_stock_levels").select("available").eq("bundle_id", item.id).maybeSingle(),
      auth.supabase.from("bundle_items").select("quantity, items(id, sku, name)").eq("bundle_id", item.id),
    ]);
    stock = bundleStock?.available ?? 0;
    constituents = (bundleItems ?? []).flatMap((bi) => {
      const constituentItem = Array.isArray(bi.items) ? bi.items[0] : bi.items;
      if (!constituentItem) return [];
      return [{ itemId: constituentItem.id, sku: constituentItem.sku, name: constituentItem.name, quantity: bi.quantity }];
    });
  } else {
    stock = await getCurrentStock(auth.supabase, item.id);
  }

  return Response.json({
    id: item.id,
    sku: item.sku,
    name: item.name,
    description: item.description,
    category: category?.name ?? null,
    unitPrice: item.unit_price,
    isBundle: item.is_bundle,
    isActive: item.is_active,
    stock,
    reorderThreshold: item.reorder_threshold,
    ...(item.is_bundle ? { constituents } : {}),
  });
}
