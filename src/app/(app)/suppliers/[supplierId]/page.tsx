import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { updateSupplier } from "@/actions/suppliers";
import { SupplierForm } from "../_components/SupplierForm";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BackLink } from "@/components/ui/BackLink";

type PoRow = {
  id: string;
  po_number: string;
  status: string;
  ordered_at: string | null;
  expected_at: string | null;
};

type LineRow = {
  id: string;
  purchase_order_id: string;
  unit_cost: number;
  items: { name: string; sku: string } | { name: string; sku: string }[] | null;
};

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

// Everything here is derived from data that already exists (purchase_orders,
// purchase_order_lines, and the po_receipt stock_movements each receipt
// already posts) -- no new columns needed. "Received at" for a PO is the
// latest po_receipt movement among its lines, which is more precise than
// purchase_orders.updated_at (that can also move for unrelated edits, or
// for each partial receipt rather than just the final one).
export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = await params;
  const supabase = await createClient();
  const permissions = await getPermissions();

  if (permissions.suppliers?.edit !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to edit suppliers.
      </p>
    );
  }

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", supplierId)
    .single();

  if (!supplier) notFound();

  const { data: orders } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status, ordered_at, expected_at")
    .eq("supplier_id", supplierId)
    .order("ordered_at", { ascending: false })
    .returns<PoRow[]>();

  const poIds = (orders ?? []).map((o) => o.id);

  const [{ data: lines }, { data: receipts }] = await Promise.all([
    poIds.length
      ? supabase
          .from("purchase_order_lines")
          .select("id, purchase_order_id, unit_cost, items(name, sku)")
          .in("purchase_order_id", poIds)
          .returns<LineRow[]>()
      : Promise.resolve({ data: [] as LineRow[] }),
    poIds.length
      ? supabase
          .from("stock_movements")
          .select("reference_id, created_at")
          .eq("reference_table", "purchase_order_lines")
          .eq("movement_type", "po_receipt")
      : Promise.resolve({ data: [] as { reference_id: string; created_at: string }[] }),
  ]);

  const lineToPo = new Map((lines ?? []).map((l) => [l.id, l.purchase_order_id]));
  const lastReceiptByPo = new Map<string, string>();
  for (const r of receipts ?? []) {
    const poId = lineToPo.get(r.reference_id);
    if (!poId) continue;
    const existing = lastReceiptByPo.get(poId);
    if (!existing || r.created_at > existing) lastReceiptByPo.set(poId, r.created_at);
  }

  const receivedOrders = (orders ?? []).filter((o) => o.status === "received" && lastReceiptByPo.has(o.id));
  const leadTimes = receivedOrders
    .filter((o) => o.ordered_at)
    .map((o) => daysBetween(o.ordered_at!, lastReceiptByPo.get(o.id)!));
  const avgLeadTime = leadTimes.length ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;

  const ordersWithExpected = receivedOrders.filter((o) => o.expected_at);
  const onTimeCount = ordersWithExpected.filter(
    (o) => lastReceiptByPo.get(o.id)!.slice(0, 10) <= o.expected_at!,
  ).length;

  const priceHistory = (lines ?? [])
    .map((l) => {
      const item = Array.isArray(l.items) ? l.items[0] : l.items;
      const po = orders?.find((o) => o.id === l.purchase_order_id);
      return {
        id: l.id,
        itemName: item?.name ?? "—",
        itemSku: item?.sku ?? "—",
        unitCost: l.unit_cost,
        poNumber: po?.po_number ?? "—",
        orderedAt: po?.ordered_at ?? "",
      };
    })
    .sort((a, b) => b.orderedAt.localeCompare(a.orderedAt))
    .slice(0, 20);

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink href="/suppliers" label="Suppliers" />
      <Card>
        <h1 className="mb-6 text-2xl font-medium text-on-surface">
          Edit {supplier.name}
        </h1>
        <SupplierForm action={updateSupplier} defaults={supplier} submitLabel="Save changes" />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-on-surface">Performance</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-on-surface-variant">Orders placed</p>
            <p className="mt-1 text-2xl font-medium text-on-surface">{orders?.length ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-on-surface-variant">Avg. lead time</p>
            <p className="mt-1 text-2xl font-medium text-on-surface">
              {avgLeadTime !== null ? `${avgLeadTime.toFixed(1)}d` : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-on-surface-variant">On-time delivery</p>
            <p className="mt-1 text-2xl font-medium text-on-surface">
              {ordersWithExpected.length ? `${Math.round((onTimeCount / ordersWithExpected.length) * 100)}%` : "—"}
            </p>
            {ordersWithExpected.length > 0 && (
              <p className="text-xs text-on-surface-variant">
                {onTimeCount} of {ordersWithExpected.length} with a delivery date
              </p>
            )}
          </div>
        </div>
        {!receivedOrders.length && (
          <p className="mt-4 text-sm text-on-surface-variant">
            No fully received orders yet — these numbers fill in once at least one order from this supplier is received.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-medium text-on-surface">Recent prices</h2>
        <p className="mb-4 text-xs text-on-surface-variant">
          Unit cost paid per item on this supplier&apos;s most recent orders, most recent first.
        </p>
        <div className="space-y-2">
          {priceHistory.map((row) => (
            <div key={row.id} className="flex items-center justify-between border-t border-outline-variant/60 pt-2 text-sm first:border-0 first:pt-0">
              <div className="min-w-0">
                <p className="truncate text-on-surface">{row.itemName}</p>
                <p className="font-mono text-xs text-on-surface-variant">
                  {row.itemSku} · {row.poNumber} · {row.orderedAt || "—"}
                </p>
              </div>
              <Badge tone="neutral" className="shrink-0">₱{row.unitCost}</Badge>
            </div>
          ))}
          {!priceHistory.length && <p className="text-sm text-on-surface-variant">No orders recorded yet.</p>}
        </div>
      </Card>
    </div>
  );
}
