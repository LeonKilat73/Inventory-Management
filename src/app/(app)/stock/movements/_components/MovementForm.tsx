"use client";

import { useActionState, useState } from "react";
import { recordStockMovement, type ActionState } from "@/actions/stockMovements";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";

type Item = { id: string; name: string; sku: string };

const initialState: ActionState = { error: null };

const MOVEMENT_LABELS: Record<string, string> = {
  sale: "Sale (decreases stock)",
  replacement_out: "Replacement sent out (decreases stock)",
  replacement_in: "Replacement received (increases stock)",
  manual_adjustment: "Manual adjustment (pick a direction)",
};

export function MovementForm({ items }: { items: Item[] }) {
  const [state, formAction, pending] = useActionState(recordStockMovement, initialState);
  const [movementType, setMovementType] = useState("sale");

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

      <SelectField
        label="Movement type"
        name="movementType"
        value={movementType}
        onChange={(e) => setMovementType(e.target.value)}
      >
        {Object.entries(MOVEMENT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>

      {movementType === "manual_adjustment" && (
        <SelectField label="Direction" name="direction" required>
          <option value="increase">Increase stock</option>
          <option value="decrease">Decrease stock</option>
        </SelectField>
      )}

      <div className="grid grid-cols-2 gap-4">
        <TextField label="Quantity" name="quantity" type="number" min={1} required />
      </div>

      <TextField label="Note" name="note" />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record movement"}
      </Button>
    </form>
  );
}
