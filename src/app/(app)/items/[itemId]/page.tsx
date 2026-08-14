import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { updateItem } from "@/actions/items";
import { ItemForm } from "../_components/ItemForm";
import { QuickAdjustStockForm } from "../_components/QuickAdjustStockForm";
import { Card } from "@/components/ui/Card";
import { BackLink } from "@/components/ui/BackLink";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const supabase = await createClient();
  const permissions = await getPermissions();

  if (permissions.items?.edit !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to edit items.
      </p>
    );
  }

  const [{ data: item }, { data: categories }, { data: stockLevel }] = await Promise.all([
    supabase.from("items").select("*").eq("id", itemId).single(),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("item_stock_levels").select("current_stock").eq("item_id", itemId).single(),
  ]);

  if (!item) notFound();

  const canAdjustStock = permissions.stock_movements?.create === true;

  return (
    <div className="max-w-xl">
      <BackLink href="/items" label="Items" />

      <Card>
        <h1 className="mb-6 text-2xl font-medium text-on-surface">
          Edit {item.name}
        </h1>
        <ItemForm
          action={updateItem}
          categories={categories ?? []}
          defaults={item}
          submitLabel="Save changes"
        />
      </Card>

      {!item.is_bundle && (
        <div className="mt-6">
          {canAdjustStock ? (
            <QuickAdjustStockForm itemId={item.id} currentStock={stockLevel?.current_stock ?? 0} />
          ) : (
            <p className="text-sm text-on-surface-variant">
              Current stock: {stockLevel?.current_stock ?? 0}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
