"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseOrder } from "@/actions/purchaseOrders";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";

export type SuggestedLine = {
  itemId: string;
  name: string;
  sku: string;
  stock: number;
  reorderThreshold: number;
  suggestedQuantity: number;
  suggestedUnitCost: number;
};

type Supplier = { id: string; name: string };

// Pre-fills a purchase order from low-stock suggestions and submits through
// the exact same createPurchaseOrder action the regular "New purchase
// order" form uses -- this is just a different way of arriving at the same
// call, not a parallel PO-creation path. Calls the action directly (not via
// useActionState + <form action>) so it can redirect to the newly created
// draft PO on success, matching the pattern already used elsewhere in this
// app for actions that need a client-side follow-up.
export function ReorderGroup({
  supplierId,
  supplierName,
  lines,
  suppliers,
  defaultPoNumber,
}: {
  supplierId: string | null;
  supplierName: string;
  lines: SuggestedLine[];
  suppliers: Supplier[];
  defaultPoNumber: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.itemId, l.suggestedQuantity])),
  );
  const [unitCosts, setUnitCosts] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.itemId, l.suggestedUnitCost])),
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await createPurchaseOrder({ error: null }, formData);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    if (result.poId) router.push(`/purchase-orders/${result.poId}`);
  }

  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-5">
      <h3 className="font-medium text-on-surface">{supplierName}</h3>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        {supplierId ? (
          <input type="hidden" name="supplierId" value={supplierId} />
        ) : (
          <SelectField label="Supplier" name="supplierId" required defaultValue="">
            <option value="" disabled>
              Select a supplier…
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        )}
        <TextField label="PO number" name="poNumber" defaultValue={defaultPoNumber} required />

        <div className="grid grid-cols-[1fr_70px_80px_100px] gap-3 text-xs font-medium text-on-surface-variant">
          <span>Item</span>
          <span>Stock</span>
          <span>Qty</span>
          <span>Unit cost</span>
        </div>
        {lines.map((line) => (
          <div key={line.itemId} className="grid grid-cols-[1fr_70px_80px_100px] items-center gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate text-on-surface">{line.name}</p>
              <p className="font-mono text-xs text-on-surface-variant">{line.sku}</p>
            </div>
            <span className="text-xs text-on-surface-variant">
              {line.stock}/{line.reorderThreshold}
            </span>
            <input type="hidden" name="itemId" value={line.itemId} />
            <input
              type="number"
              name="quantity"
              min={1}
              value={quantities[line.itemId]}
              onChange={(e) =>
                setQuantities((q) => ({ ...q, [line.itemId]: Number(e.target.value) }))
              }
              className="w-full rounded-md border border-outline bg-surface px-2 py-1.5 text-sm text-on-surface"
            />
            <input
              type="number"
              name="unitCost"
              min={0}
              step="0.01"
              value={unitCosts[line.itemId]}
              onChange={(e) =>
                setUnitCosts((u) => ({ ...u, [line.itemId]: Number(e.target.value) }))
              }
              className="w-full rounded-md border border-outline bg-surface px-2 py-1.5 text-sm text-on-surface"
            />
          </div>
        ))}

        {error && <p className="text-sm text-error">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : `Create draft PO (${lines.length} item${lines.length === 1 ? "" : "s"})`}
        </Button>
      </form>
    </div>
  );
}
