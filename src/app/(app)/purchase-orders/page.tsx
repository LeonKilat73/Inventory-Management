import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { PurchaseOrderForm } from "./_components/PurchaseOrderForm";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const STATUS_TONE = {
  draft: "neutral",
  submitted: "tertiary",
  partially_received: "secondary",
  received: "primary",
  cancelled: "error",
} as const;

type PoRow = {
  id: string;
  po_number: string;
  status: keyof typeof STATUS_TONE;
  ordered_at: string | null;
  expected_at: string | null;
  suppliers: { name: string } | { name: string }[] | null;
};

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  const [{ data: orders }, { data: suppliers }, { data: items }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, po_number, status, ordered_at, expected_at, suppliers(name)")
      .order("created_at", { ascending: false })
      .returns<PoRow[]>(),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("items").select("id, name, sku").eq("is_bundle", false).order("name"),
  ]);

  const canCreate = permissions.purchase_orders?.create === true;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-on-surface">Purchase Orders</h1>
          <p className="text-sm text-on-surface-variant">
            Order stock from suppliers. Receiving a PO automatically increases item stock.
          </p>
        </div>
        {permissions.purchase_orders?.create === true && (
          <Link
            href="/purchase-orders/reorder"
            className="shrink-0 text-sm text-primary underline underline-offset-2"
          >
            Reorder low stock →
          </Link>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-outline-variant/60 md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">PO #</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ordered</th>
              <th className="px-4 py-3 font-medium">Expected</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders?.map((po) => {
              const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
              return (
                <tr
                  key={po.id}
                  className="border-t border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low"
                >
                  <td className="px-4 py-3 font-mono text-xs">{po.po_number}</td>
                  <td className="px-4 py-3">{supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[po.status]}>{po.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{po.ordered_at ?? "—"}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{po.expected_at ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="text-primary underline underline-offset-2"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!orders?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">
                  No purchase orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {orders?.map((po) => {
          const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
          return (
            <Link
              key={po.id}
              href={`/purchase-orders/${po.id}`}
              className="block rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-xs text-on-surface-variant">{po.po_number}</p>
                <Badge tone={STATUS_TONE[po.status]}>{po.status.replace("_", " ")}</Badge>
              </div>
              <p className="mt-1 font-medium text-on-surface">{supplier?.name ?? "—"}</p>
              <div className="mt-2 flex gap-4 text-xs text-on-surface-variant">
                <span>Ordered {po.ordered_at ?? "—"}</span>
                <span>Expected {po.expected_at ?? "—"}</span>
              </div>
            </Link>
          );
        })}
        {!orders?.length && (
          <p className="text-center text-sm text-on-surface-variant">No purchase orders yet.</p>
        )}
      </div>

      {canCreate && (
        <Card className="max-w-2xl">
          <h2 className="mb-4 text-lg font-medium text-on-surface">New purchase order</h2>
          <PurchaseOrderForm suppliers={suppliers ?? []} items={items ?? []} />
        </Card>
      )}
    </div>
  );
}
