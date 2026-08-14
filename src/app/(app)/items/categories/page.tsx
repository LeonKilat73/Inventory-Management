import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { BackLink } from "@/components/ui/BackLink";
import { AddCategoryButton } from "./_components/AddCategoryButton";
import { EditCategoryButton } from "./_components/EditCategoryButton";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, sku_prefix, sku_next_number")
    .order("name");

  const canCreate = permissions.items?.create === true;
  const canEdit = permissions.items?.edit === true;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <BackLink href="/items" label="items" />
          <h1 className="text-2xl font-medium text-on-surface">Categories</h1>
          <p className="text-sm text-on-surface-variant">
            Set a SKU prefix per category to auto-generate SKUs when adding new items.
          </p>
        </div>
        {canCreate && <AddCategoryButton />}
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">SKU prefix</th>
              <th className="px-4 py-3 font-medium">Next SKU</th>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {categories?.map((category) => (
              <tr
                key={category.id}
                className="border-t border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low"
              >
                <td className="px-4 py-3">{category.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{category.sku_prefix ?? "—"}</td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {category.sku_prefix
                    ? `${category.sku_prefix}-${String(category.sku_next_number).padStart(4, "0")}`
                    : "—"}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <EditCategoryButton category={category} />
                  </td>
                )}
              </tr>
            ))}
            {!categories?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant">
                  No categories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
