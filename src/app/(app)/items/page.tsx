import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { createItem, deleteItem } from "@/actions/items";
import { ItemForm } from "./_components/ItemForm";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Items</h1>
          <p className="text-sm text-zinc-500">
            Catalog of individual items. See{" "}
            <Link href="/items/bundles" className="underline underline-offset-2">
              Bundles
            </Link>{" "}
            for packages made of multiple items.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Cost</th>
              <th className="px-4 py-2 font-medium">Price</th>
              <th className="px-4 py-2 font-medium">Reorder at</th>
              {(canEdit || canDelete) && <th className="px-4 py-2" />}
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
                  className="border-t border-black/10 dark:border-white/10"
                >
                  <td className="px-4 py-2 font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-2">{item.name}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {item.unit_cost != null ? `$${item.unit_cost}` : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {item.unit_price != null ? `$${item.unit_price}` : "—"}
                  </td>
                  <td className="px-4 py-2">{item.reorder_threshold}</td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        {canEdit && (
                          <Link
                            href={`/items/${item.id}`}
                            className="text-zinc-500 underline underline-offset-2 hover:text-foreground"
                          >
                            Edit
                          </Link>
                        )}
                        {canDelete && (
                          <form action={deleteItem.bind(null, item.id)}>
                            <button
                              type="submit"
                              className="text-red-600 underline underline-offset-2 dark:text-red-400"
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
                  className="px-4 py-6 text-center text-zinc-500"
                >
                  No items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <div className="max-w-xl rounded-lg border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 text-lg font-semibold text-foreground">New item</h2>
          <ItemForm
            action={createItem}
            categories={categories ?? []}
            submitLabel="Create item"
          />
        </div>
      )}
    </div>
  );
}
