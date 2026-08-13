import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { deleteBundle } from "@/actions/items";
import { BundleForm } from "./_components/BundleForm";

type BundleRow = {
  id: string;
  sku: string;
  name: string;
  unit_price: number | null;
  bundles: {
    bundle_price: number;
    bundle_items: { quantity: number; items: { sku: string; name: string } }[];
  } | null;
};

export default async function BundlesPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  const [{ data: bundles }, { data: plainItems }] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id, sku, name, unit_price, bundles(bundle_price, bundle_items(quantity, items(sku, name)))",
      )
      .eq("is_bundle", true)
      .order("name")
      .returns<BundleRow[]>(),
    supabase.from("items").select("id, sku, name").eq("is_bundle", false).order("name"),
  ]);

  const canCreate = permissions.bundles?.create === true;
  const canDelete = permissions.bundles?.delete === true;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Bundles</h1>
        <p className="text-sm text-zinc-500">
          Packages of multiple items sold together at one price. Stock is
          tracked on the constituent items, not the bundle itself.
        </p>
      </div>

      <div className="space-y-4">
        {bundles?.map((bundle) => (
          <div
            key={bundle.id}
            className="rounded-lg border border-black/10 p-4 dark:border-white/10"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{bundle.name}</p>
                <p className="font-mono text-xs text-zinc-500">{bundle.sku}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-medium text-foreground">
                  ${bundle.bundles?.bundle_price ?? bundle.unit_price}
                </p>
                {canDelete && (
                  <form action={deleteBundle.bind(null, bundle.id)}>
                    <button
                      type="submit"
                      className="text-sm text-red-600 underline underline-offset-2 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-zinc-500">
              {bundle.bundles?.bundle_items.map((bi, i) => (
                <li key={i}>
                  {bi.quantity} × {bi.items.name} ({bi.items.sku})
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!bundles?.length && (
          <p className="text-sm text-zinc-500">No bundles yet.</p>
        )}
      </div>

      {canCreate && (
        <div className="max-w-xl rounded-lg border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            New bundle
          </h2>
          <BundleForm items={plainItems ?? []} />
        </div>
      )}
    </div>
  );
}
