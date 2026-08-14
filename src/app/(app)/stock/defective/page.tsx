import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { ReportDefectiveForm } from "./_components/ReportDefectiveForm";
import { ResolveForm } from "./_components/ResolveForm";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const STATUS_TONE = {
  pending: "error",
  returned_to_supplier: "secondary",
  replaced: "primary",
  written_off: "neutral",
  restocked: "tertiary",
} as const;

type DefectiveRow = {
  id: string;
  quantity: number;
  reason: string | null;
  status: keyof typeof STATUS_TONE;
  created_at: string;
  resolved_at: string | null;
  items: { name: string; sku: string } | { name: string; sku: string }[] | null;
};

export default async function DefectiveItemsPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  if (permissions.defective_items?.view !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view defective items.
      </p>
    );
  }

  const [{ data: reports }, { data: items }, { data: purchaseOrders }] = await Promise.all([
    supabase
      .from("defective_items")
      .select("id, quantity, reason, status, created_at, resolved_at, items(name, sku)")
      .order("created_at", { ascending: false })
      .returns<DefectiveRow[]>(),
    supabase.from("items").select("id, name, sku").eq("is_bundle", false).order("name"),
    supabase.from("purchase_orders").select("id, po_number").order("created_at", { ascending: false }),
  ]);

  const canCreate = permissions.defective_items?.create === true;
  const canEdit = permissions.defective_items?.edit === true;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">Defective Items</h1>
        <p className="text-sm text-on-surface-variant">
          Reporting a defective item immediately removes it from sellable
          stock. Resolve it once you know what happened.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Reported</th>
              {canEdit && <th className="px-4 py-3 font-medium">Resolve</th>}
            </tr>
          </thead>
          <tbody>
            {reports?.map((r) => {
              const item = Array.isArray(r.items) ? r.items[0] : r.items;
              return (
                <tr
                  key={r.id}
                  className="border-t border-outline-variant/60 bg-surface-container-lowest"
                >
                  <td className="px-4 py-3">
                    {item?.name} <span className="text-on-surface-variant">({item?.sku})</span>
                  </td>
                  <td className="px-4 py-3">{r.quantity}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{r.reason ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[r.status]}>{r.status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      {r.status === "pending" ? (
                        <ResolveForm defectiveId={r.id} />
                      ) : (
                        <span className="text-on-surface-variant">Resolved</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {!reports?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">
                  No defective items reported.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <Card className="max-w-xl">
          <h2 className="mb-4 text-lg font-medium text-on-surface">Report a defective item</h2>
          <ReportDefectiveForm items={items ?? []} purchaseOrders={purchaseOrders ?? []} />
        </Card>
      )}
    </div>
  );
}
