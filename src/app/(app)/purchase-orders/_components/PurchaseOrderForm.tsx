"use client";

import { useActionState, useState } from "react";
import { createPurchaseOrder, type ActionState } from "@/actions/purchaseOrders";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";

type Supplier = { id: string; name: string };
type Item = { id: string; name: string; sku: string };
type Approver = { id: string; name: string; email: string };

const initialState: ActionState = { error: null };

export function PurchaseOrderForm({
  suppliers,
  items,
  approvers,
}: {
  suppliers: Supplier[];
  items: Item[];
  approvers: Approver[];
}) {
  const [state, formAction, pending] = useActionState(createPurchaseOrder, initialState);
  const [rowCount, setRowCount] = useState(2);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Expected delivery date" name="expectedAt" type="date" />
        <div>
          <SelectField label="Send to for approval" name="approverId" required defaultValue="">
            <option value="" disabled>
              Select who will approve…
            </option>
            {approvers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.email})
              </option>
            ))}
          </SelectField>
          <p className="mt-1 text-xs text-on-surface-variant">
            {approvers.length === 0
              ? "No one else can approve purchase orders yet. Give a manager or admin the approve permission first."
              : "They get a notification and an email with a link, and only they can approve or reject it. You can't approve your own order."}
          </p>
        </div>
      </div>

      <TextAreaField label="Notes" name="notes" />

      <div className="space-y-3">
        <span className="block text-sm font-medium text-on-surface-variant">
          Line items
        </span>
        {Array.from({ length: rowCount }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-3 border-b border-outline-variant/60 pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_100px_120px] sm:border-0 sm:pb-0"
          >
            <SelectField label="Item" name="itemId" required>
              <option value="">Select an item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </SelectField>
            <TextField label="Quantity" name="quantity" type="number" min={1} defaultValue={1} required />
            <TextField label="Unit cost" name="unitCost" type="number" step="0.01" min={0} required />
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
      {!state.error && state.notice && <p className="text-sm text-on-surface-variant">{state.notice}</p>}

      <Button type="submit" disabled={pending || approvers.length === 0}>
        {pending ? "Saving…" : "Create purchase order"}
      </Button>
    </form>
  );
}
