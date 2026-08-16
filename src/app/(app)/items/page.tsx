import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { buildCategoryOptions } from "@/lib/categoryOptions";
import { AddItemButton } from "./_components/AddItemButton";
import { ItemsTable, type ItemRow } from "./_components/ItemsTable";

export default async function ItemsPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  const [{ data: items }, { data: categories }, { data: stockLevels }] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id, sku, name, unit_price, unit_cost, reorder_threshold, is_active, categories(name)",
      )
      .eq("is_bundle", false)
      .order("name"),
    supabase.from("categories").select("id, name, parent_id").order("name"),
    supabase.from("item_stock_levels").select("item_id, current_stock"),
  ]);

  const stockByItemId = new Map((stockLevels ?? []).map((s) => [s.item_id, s.current_stock]));

  const canCreate = permissions.items?.create === true;
  const canEdit = permissions.items?.edit === true;
  const canDelete = permissions.items?.delete === true;

  const rows: ItemRow[] = (items ?? []).map((item) => {
    const category = Array.isArray(item.categories) ? item.categories[0] : item.categories;
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      categoryName: category?.name ?? null,
      stock: stockByItemId.get(item.id) ?? 0,
      reorderThreshold: item.reorder_threshold,
      unitCost: item.unit_cost,
      unitPrice: item.unit_price,
      isActive: item.is_active,
    };
  });

  const categoryNames = [...new Set(rows.map((r) => r.categoryName).filter((n): n is string => n !== null))].sort();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-on-surface">Items</h1>
          <p className="text-sm text-on-surface-variant">
            Catalog of individual items. See{" "}
            <Link href="/items/bundles" className="text-primary underline underline-offset-2">
              Bundles
            </Link>{" "}
            for packages made of multiple items, or{" "}
            <Link href="/items/categories" className="text-primary underline underline-offset-2">
              Categories
            </Link>{" "}
            to manage SKU prefixes.
          </p>
        </div>
        {canCreate && <AddItemButton categories={buildCategoryOptions(categories ?? [])} />}
      </div>

      <ItemsTable items={rows} categoryNames={categoryNames} canEdit={canEdit} canDelete={canDelete} />
    </div>
  );
}
