"use client";

import { useActionState, useState } from "react";
import { createPurchaseOrder, type ActionState } from "@/actions/purchaseOrders";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";

type Supplier = { id: string; name: string };
type Item = { id: string; name: string; sku: string };

const initialState: ActionState = { error: null };

export function PurchaseOrderForm({
  suppliers,
  items,
}: {
  suppliers: Supplier[];
  items: Item[];
}) {
  const [state, formAction, pending] = useActionState(createPurchaseOrder, initialState);
  const [rowCount, setRowCount] = useState(2);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Supplier" name="supplierId" required>
          <option value="">Select a supplier…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <TextField label="PO number" name="poNumber" placeholder="PO-1001" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField label="Expected delivery date" name="expectedAt" type="date" />
      </div>

      <TextAreaField label="Notes" name="notes" />

      <div className="space-y-2">
        <span className="block text-sm font-medium text-on-surface-variant">
          Line items
        </span>
        <div className="grid grid-cols-[1fr_100px_120px] gap-3 text-xs font-medium text-on-surface-variant">
          <span>Item</span>
          <span>Quantity</span>
          <span>Unit cost</span>
        </div>
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} className="grid grid-cols-[1fr_100px_120px] gap-3">
            <SelectField label="" name="itemId" required>
              <option value="">Select an item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </SelectField>
            <TextField label="" name="quantity" type="number" min={1} defaultValue={1} required />
            <TextField label="" name="unitCost" type="number" step="0.01" min={0} required />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRowCount((n) => n + 1)}
          className="text-sm text-primary underline underline-offset-2"
        >
          + Add another item
        </button>
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create purchase order"}
      </Button>
    </form>
  );
}
