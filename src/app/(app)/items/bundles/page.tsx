import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { buildCategoryOptions } from "@/lib/categoryOptions";
import { AddBundleButton } from "./_components/AddBundleButton";
import { BundleActions } from "./_components/BundleActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type BundleRow = {
  id: string;
  sku: string;
  name: string;
  unit_price: number | null;
  is_active: boolean;
  bundles: {
    bundle_price: number;
    bundle_items: { quantity: number; items: { sku: string; name: string } }[];
  } | null;
};

export default async function BundlesPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  const [{ data: bundles }, { data: plainItems }, { data: availability }, { data: categories }] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id, sku, name, unit_price, is_active, bundles(bundle_price, bundle_items(quantity, items(sku, name)))",
      )
      .eq("is_bundle", true)
      .order("name")
      .returns<BundleRow[]>(),
    supabase.from("items").select("id, sku, name").eq("is_bundle", false).order("name"),
    supabase.from("bundle_stock_levels").select("bundle_id, available"),
    supabase.from("categories").select("id, name, parent_id").order("name"),
  ]);

  const availableByBundleId = new Map((availability ?? []).map((a) => [a.bundle_id, a.available]));

  const canCreate = permissions.bundles?.create === true;
  const canDelete = permissions.bundles?.delete === true;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-on-surface">Bundles</h1>
          <p className="text-sm text-on-surface-variant">
            Packages of multiple items sold together at one price. Stock is
            tracked on the constituent items, not the bundle itself.
          </p>
        </div>
        {canCreate && (
          <AddBundleButton items={plainItems ?? []} categories={buildCategoryOptions(categories ?? [])} />
        )}
      </div>

      <div className="space-y-4">
        {bundles?.map((bundle) => (
          <Card key={bundle.id}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-on-surface">{bundle.name}</p>
                  {!bundle.is_active && <Badge tone="neutral">Deactivated</Badge>}
                </div>
                <p className="font-mono text-xs text-on-surface-variant">{bundle.sku}</p>
                <Badge tone="secondary" className="mt-2">
                  {availableByBundleId.get(bundle.id) ?? 0} available
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-medium text-on-surface">
                  ${bundle.bundles?.bundle_price ?? bundle.unit_price}
                </p>
                <BundleActions bundleId={bundle.id} isActive={bundle.is_active} canDelete={canDelete} />
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-on-surface-variant">
              {bundle.bundles?.bundle_items.map((bi, i) => (
                <li key={i}>
                  {bi.quantity} × {bi.items.name} ({bi.items.sku})
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {!bundles?.length && (
          <p className="text-sm text-on-surface-variant">No bundles yet.</p>
        )}
      </div>
    </div>
  );
}
