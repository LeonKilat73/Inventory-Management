import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { ReorderGroup, type SuggestedLine } from "./_components/ReorderGroup";

type ItemRow = {
  id: string;
  sku: string;
  name: string;
  unit_cost: number | null;
  reorder_threshold: number;
  reorder_quantity: number | null;
};

type LastSupplierRow = {
  item_id: string;
  unit_cost: number;
  purchase_orders: { supplier_id: string; created_at: string } | { supplier_id: string; created_at: string }[] | null;
};

function poNumberFor(index: number) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `RO-${today}-${index + 1}`;
}

// Turns the existing low-stock signal (already shown on the Dashboard) into
// something actionable: one draft PO per supplier, pre-filled with a
// suggested quantity and unit cost, submitted through the same
// createPurchaseOrder action the manual "New purchase order" form uses.
// Nothing here writes anything on its own -- every group still requires an
// explicit "Create draft PO" click, and the result is a normal draft PO the
// user reviews/edits/submits exactly like any other.
export default async function ReorderPage() {
  const permissions = await getPermissions();
  if (permissions.purchase_orders?.create !== true) {
    return <p className="text-sm text-on-surface-variant">You don&apos;t have permission to create purchase orders.</p>;
  }

  const supabase = await createClient();

  const [{ data: items }, { data: stockLevels }, { data: suppliers }] = await Promise.all([
    supabase
      .from("items")
      .select("id, sku, name, unit_cost, reorder_threshold, reorder_quantity")
      .eq("is_bundle", false)
      .eq("is_active", true)
      .returns<ItemRow[]>(),
    supabase.from("item_stock_levels").select("item_id, current_stock"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
  ]);

  const stockByItemId = new Map((stockLevels ?? []).map((s) => [s.item_id, s.current_stock]));
  const lowStockItems = (items ?? [])
    .map((item) => ({ ...item, stock: stockByItemId.get(item.id) ?? 0 }))
    .filter((item) => item.stock <= item.reorder_threshold);

  const lowStockIds = lowStockItems.map((i) => i.id);
  const { data: lastSupplierRows } =
    lowStockIds.length > 0
      ? await supabase
          .from("purchase_order_lines")
          .select("item_id, unit_cost, purchase_orders(supplier_id, created_at)")
          .in("item_id", lowStockIds)
          .returns<LastSupplierRow[]>()
      : { data: [] as LastSupplierRow[] };

  // Most recent PO line per item -- that PO's supplier and unit cost become
  // the suggestion. An item with no purchase history at all falls back to
  // its own unit_cost and lands in the "no supplier history" group, since
  // there's nothing to infer a supplier from.
  const lastByItem = new Map<string, { supplierId: string; unitCost: number; at: string }>();
  for (const row of lastSupplierRows ?? []) {
    const po = Array.isArray(row.purchase_orders) ? row.purchase_orders[0] : row.purchase_orders;
    if (!po) continue;
    const existing = lastByItem.get(row.item_id);
    if (!existing || po.created_at > existing.at) {
      lastByItem.set(row.item_id, { supplierId: po.supplier_id, unitCost: row.unit_cost, at: po.created_at });
    }
  }

  const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));

  const groups = new Map<string, { supplierId: string | null; supplierName: string; lines: SuggestedLine[] }>();
  for (const item of lowStockItems) {
    const last = lastByItem.get(item.id);
    const supplierId = last?.supplierId ?? null;
    const key = supplierId ?? "__none__";
    if (!groups.has(key)) {
      groups.set(key, {
        supplierId,
        supplierName: supplierId ? (supplierNameById.get(supplierId) ?? "Unknown supplier") : "No supplier history",
        lines: [],
      });
    }
    groups.get(key)!.lines.push({
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      stock: item.stock,
      reorderThreshold: item.reorder_threshold,
      suggestedQuantity:
        item.reorder_quantity ?? Math.max(item.reorder_threshold * 2 - item.stock, item.reorder_threshold, 1),
      suggestedUnitCost: last?.unitCost ?? Number(item.unit_cost ?? 0),
    });
  }

  // Named suppliers first, "no supplier history" (if present) last -- that
  // group needs a manual pick before it can be submitted, so it shouldn't
  // be the first thing in view.
  const sortedGroups = [...groups.values()].sort((a, b) => {
    if (!a.supplierId) return 1;
    if (!b.supplierId) return -1;
    return a.supplierName.localeCompare(b.supplierName);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-on-surface">Reorder suggestions</h1>
          <p className="text-sm text-on-surface-variant">
            Every active item at or below its reorder threshold, grouped by the supplier it was last ordered from.
          </p>
        </div>
        <Link href="/purchase-orders" className="shrink-0 text-sm text-primary underline underline-offset-2">
          ← Purchase Orders
        </Link>
      </div>

      {sortedGroups.length === 0 && (
        <p className="text-sm text-on-surface-variant">Nothing needs reordering right now.</p>
      )}

      <div className="space-y-6">
        {sortedGroups.map((group, i) => (
          <ReorderGroup
            key={group.supplierId ?? "none"}
            supplierId={group.supplierId}
            supplierName={group.supplierName}
            lines={group.lines}
            suppliers={suppliers ?? []}
            defaultPoNumber={poNumberFor(i)}
          />
        ))}
      </div>
    </div>
  );
}
