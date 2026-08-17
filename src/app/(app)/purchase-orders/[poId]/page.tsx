import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { submitPurchaseOrder } from "@/actions/purchaseOrders";
import { ReceiveLineForm } from "../_components/ReceiveLineForm";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";

const STATUS_TONE = {
  draft: "neutral",
  submitted: "tertiary",
  partially_received: "secondary",
  received: "primary",
  cancelled: "error",
} as const;

type LineRow = {
  id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  items: { id: string; sku: string; name: string } | { id: string; sku: string; name: string }[];
};

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ poId: string }>;
}) {
  const { poId } = await params;
  const supabase = await createClient();
  const permissions = await getPermissions();

  if (permissions.purchase_orders?.view !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view purchase orders.
      </p>
    );
  }

  const [{ data: po }, { data: lines }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, po_number, status, ordered_at, expected_at, notes, suppliers(name)")
      .eq("id", poId)
      .single(),
    supabase
      .from("purchase_order_lines")
      .select("id, quantity_ordered, quantity_received, unit_cost, items(id, sku, name)")
      .eq("purchase_order_id", poId)
      .returns<LineRow[]>(),
  ]);

  if (!po) notFound();

  const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
  const canEdit = permissions.purchase_orders?.edit === true;
  const canReceive = permissions.purchase_orders?.receive === true;
  const canReceiveNow = canReceive && (po.status === "submitted" || po.status === "partially_received");

  return (
    <div className="max-w-3xl space-y-8">
      <BackLink href="/purchase-orders" label="Purchase Orders" />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium text-on-surface">{po.po_number}</h1>
          <p className="text-sm text-on-surface-variant">{supplier?.name}</p>
        </div>
        <Badge tone={STATUS_TONE[po.status as keyof typeof STATUS_TONE]}>
          {po.status.replace("_", " ")}
        </Badge>
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-on-surface-variant">Ordered</dt>
            <dd className="text-on-surface">{po.ordered_at ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Expected</dt>
            <dd className="text-on-surface">{po.expected_at ?? "—"}</dd>
          </div>
          {po.notes && (
            <div className="col-span-2">
              <dt className="text-on-surface-variant">Notes</dt>
              <dd className="text-on-surface">{po.notes}</dd>
            </div>
          )}
        </dl>

        {canEdit && po.status === "draft" && (
          <form action={submitPurchaseOrder.bind(null, po.id)} className="mt-4">
            <Button type="submit" variant="tonal">
              Submit purchase order
            </Button>
          </form>
        )}
      </Card>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Ordered</th>
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Unit cost</th>
              {canReceiveNow && <th className="px-4 py-3 font-medium">Receive</th>}
            </tr>
          </thead>
          <tbody>
            {lines?.map((line) => {
              const item = Array.isArray(line.items) ? line.items[0] : line.items;
              const remaining = line.quantity_ordered - line.quantity_received;
              return (
                <tr
                  key={line.id}
                  className="border-t border-outline-variant/60 bg-surface-container-lowest"
                >
                  <td className="px-4 py-3">
                    {item?.name} <span className="text-on-surface-variant">({item?.sku})</span>
                  </td>
                  <td className="px-4 py-3">{line.quantity_ordered}</td>
                  <td className="px-4 py-3">{line.quantity_received}</td>
                  <td className="px-4 py-3">₱{line.unit_cost}</td>
                  {canReceiveNow && (
                    <td className="px-4 py-3">
                      {remaining > 0 ? (
                        <ReceiveLineForm poId={po.id} lineId={line.id} remaining={remaining} />
                      ) : (
                        <span className="text-on-surface-variant">Fully received</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
