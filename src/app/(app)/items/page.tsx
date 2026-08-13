import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { createItem, deleteItem } from "@/actions/items";
import { ItemForm } from "./_components/ItemForm";
import { Card } from "@/components/ui/Card";

export default async function ItemsPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  const [{ data: items }, { data: categories }] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id, sku, name, unit_price, unit_cost, reorder_threshold, categories(name)",
      )
      .eq("is_bundle", false)
      .order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  const canCreate = permissions.items?.create === true;
  const canEdit = permissions.items?.edit === true;
  const canDelete = permissions.items?.delete === true;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">Items</h1>
        <p className="text-sm text-on-surface-variant">
          Catalog of individual items. See{" "}
          <Link href="/items/bundles" className="text-primary underline underline-offset-2">
            Bundles
          </Link>{" "}
          for packages made of multiple items.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Reorder at</th>
              {(canEdit || canDelete) && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {items?.map((item) => {
              const category = Array.isArray(item.categories)
                ? item.categories[0]
                : item.categories;
              return (
                <tr
                  key={item.id}
                  className="border-t border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low"
                >
                  <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {item.unit_cost != null ? `$${item.unit_cost}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {item.unit_price != null ? `$${item.unit_price}` : "—"}
                  </td>
                  <td className="px-4 py-3">{item.reorder_threshold}</td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-4">
                        {canEdit && (
                          <Link
                            href={`/items/${item.id}`}
                            className="text-primary underline underline-offset-2"
                          >
                            Edit
                          </Link>
                        )}
                        {canDelete && (
                          <form action={deleteItem.bind(null, item.id)}>
                            <button
                              type="submit"
                              className="text-error underline underline-offset-2"
                            >
                              Delete
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {!items?.length && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-on-surface-variant"
                >
                  No items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <Card className="max-w-xl">
          <h2 className="mb-4 text-lg font-medium text-on-surface">New item</h2>
          <ItemForm
            action={createItem}
            categories={categories ?? []}
            submitLabel="Create item"
          />
        </Card>
      )}
    </div>
  );
}
