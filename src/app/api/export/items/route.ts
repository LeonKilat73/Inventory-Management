import { getCurrentUser, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

type Row = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit_cost: number | null;
  unit_price: number | null;
  reorder_threshold: number;
  reorder_quantity: number | null;
  is_active: boolean;
  is_bundle: boolean;
  categories: { name: string } | { name: string }[] | null;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await hasPermission("items", "view"))) return new Response("Forbidden", { status: 403 });

  const supabase = await createClient();
  const [{ data: items }, { data: stockLevels }] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id, sku, name, description, unit_cost, unit_price, reorder_threshold, reorder_quantity, is_active, is_bundle, categories(name)",
      )
      .order("name")
      .limit(50000)
      .returns<Row[]>(),
    supabase.from("item_stock_levels").select("item_id, current_stock"),
  ]);

  const stockByItemId = new Map((stockLevels ?? []).map((s) => [s.item_id, s.current_stock]));

  const rows = (items ?? []).map((item) => {
    const category = Array.isArray(item.categories) ? item.categories[0] : item.categories;
    return {
      sku: item.sku,
      name: item.name,
      description: item.description ?? "",
      category: category?.name ?? "",
      type: item.is_bundle ? "Bundle" : "Item",
      stock: stockByItemId.get(item.id) ?? 0,
      reorderThreshold: item.reorder_threshold,
      reorderQuantity: item.reorder_quantity ?? "",
      unitCost: item.unit_cost ?? "",
      unitPrice: item.unit_price ?? "",
      status: item.is_active ? "Active" : "Inactive",
    };
  });

  const csv = toCsv(rows, [
    { key: "sku", header: "SKU" },
    { key: "name", header: "Name" },
    { key: "description", header: "Description" },
    { key: "category", header: "Category" },
    { key: "type", header: "Type" },
    { key: "stock", header: "Current Stock" },
    { key: "reorderThreshold", header: "Reorder Threshold" },
    { key: "reorderQuantity", header: "Reorder Quantity" },
    { key: "unitCost", header: "Unit Cost" },
    { key: "unitPrice", header: "Unit Price" },
    { key: "status", header: "Status" },
  ]);

  return csvResponse(csv, `items-${new Date().toISOString().slice(0, 10)}.csv`);
}
