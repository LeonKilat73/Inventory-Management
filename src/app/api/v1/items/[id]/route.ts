import type { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { getCurrentStock } from "@/lib/stock/ledger";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const { data: item, error } = await auth.supabase
    .from("items")
    .select("id, sku, name, description, unit_price, unit_cost, is_bundle, is_active, reorder_threshold, categories(name)")
    .eq("id", id)
    .single();

  if (error || !item) return Response.json({ error: "Item not found." }, { status: 404 });

  const category = Array.isArray(item.categories) ? item.categories[0] : item.categories;
  const stock = await getCurrentStock(auth.supabase, item.id);

  return Response.json({
    id: item.id,
    sku: item.sku,
    name: item.name,
    description: item.description,
    category: category?.name ?? null,
    unitPrice: item.unit_price,
    unitCost: item.unit_cost,
    isBundle: item.is_bundle,
    isActive: item.is_active,
    stock,
    reorderThreshold: item.reorder_threshold,
  });
}
