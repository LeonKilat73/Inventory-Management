import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { BackLink } from "@/components/ui/BackLink";
import { AddCategoryButton } from "./_components/AddCategoryButton";
import { EditCategoryButton } from "./_components/EditCategoryButton";

function nextSkuPreview(prefix: string | null, nextNumber: number, parentPrefix?: string | null) {
  if (!prefix) return "—";
  const number = String(nextNumber).padStart(4, "0");
  return parentPrefix ? `${parentPrefix}-${prefix}-${number}` : `${prefix}-${number}`;
}

export default async function CategoriesPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, parent_id, sku_prefix, sku_next_number")
    .order("name");

  const canCreate = permissions.items?.create === true;
  const canEdit = permissions.items?.edit === true;

  const all = categories ?? [];
  const topLevel = all.filter((c) => !c.parent_id);
  const childrenByParent = new Map<string, typeof all>();
  for (const c of all) {
    if (!c.parent_id) continue;
    const list = childrenByParent.get(c.parent_id) ?? [];
    list.push(c);
    childrenByParent.set(c.parent_id, list);
  }
  const parentOptions = topLevel.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <BackLink href="/items" label="items" />
          <h1 className="text-2xl font-medium text-on-surface">Categories</h1>
          <p className="text-sm text-on-surface-variant">
            Set a SKU prefix per category to auto-generate SKUs when adding new items. Add a brand as a
            sub-category (e.g. &ldquo;QCY&rdquo; under &ldquo;Dash Cams&rdquo;) to give it its own,
            independently-numbered SKU sequence.
          </p>
        </div>
        {canCreate && <AddCategoryButton parentOptions={parentOptions} />}
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
            {topLevel.map((category) => {
              const children = childrenByParent.get(category.id) ?? [];
              return (
                <Fragment key={category.id}>
                  <tr className="border-t border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low">
                    <td className="px-4 py-3">{category.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{category.sku_prefix ?? "—"}</td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {nextSkuPreview(category.sku_prefix, category.sku_next_number)}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <EditCategoryButton category={category} parentOptions={parentOptions} />
                      </td>
                    )}
                  </tr>
                  {children.map((child) => (
                    <tr
                      key={child.id}
                      className="border-t border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low"
                    >
                      <td className="px-4 py-3 pl-10 text-on-surface-variant">↳ {child.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{child.sku_prefix ?? "—"}</td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {nextSkuPreview(child.sku_prefix, child.sku_next_number, category.sku_prefix)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <EditCategoryButton category={child} parentOptions={parentOptions} />
                        </td>
                      )}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {!topLevel.length && (
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
