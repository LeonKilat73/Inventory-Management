"use client";

import { useActionState } from "react";
import { reportDefectiveItem, type ActionState } from "@/actions/defectiveItems";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";

type Item = { id: string; name: string; sku: string };
type PurchaseOrder = { id: string; po_number: string };

const initialState: ActionState = { error: null };

export function ReportDefectiveForm({
  items,
  purchaseOrders,
}: {
  items: Item[];
  purchaseOrders: PurchaseOrder[];
}) {
  const [state, formAction, pending] = useActionState(reportDefectiveItem, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <SelectField label="Item" name="itemId" required>
        <option value="">Select an item…</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} ({item.sku})
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-4">
        <TextField label="Quantity" name="quantity" type="number" min={1} required />
        <SelectField label="Related purchase order (optional)" name="relatedPoId">
          <option value="">None</option>
          {purchaseOrders.map((po) => (
            <option key={po.id} value={po.id}>
              {po.po_number}
            </option>
          ))}
        </SelectField>
      </div>

      <TextField label="Reason" name="reason" />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Report defective item"}
      </Button>
    </form>
  );
}
