"use client";

import { useActionState, useRef, useState } from "react";
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
  const [itemId, setItemId] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  // A scanner types the SKU then Enter, same as typing it by hand -- this
  // just looks up the matching item and selects it, same as picking it from
  // the dropdown manually. No camera or scanning library involved. A plain
  // keydown handler rather than a nested <form>, since this whole component
  // is already inside the movement <form> and forms can't nest in HTML.
  function handleScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = scanRef.current?.value.trim();
    if (!code) return;
    const match = items.find((i) => i.sku.toLowerCase() === code.toLowerCase());
    if (match) {
      setItemId(match.id);
      setScanError(null);
    } else {
      setScanError(`No item matches "${code}".`);
    }
    if (scanRef.current) {
      scanRef.current.value = "";
      scanRef.current.focus();
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          ref={scanRef}
          type="text"
          onKeyDown={handleScanKeyDown}
          placeholder="Scan or type a SKU to select the item…"
          className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {scanError && <span className="shrink-0 text-xs text-error">{scanError}</span>}
      </div>

      <SelectField
        label="Item"
        name="itemId"
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
        required
      >
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
