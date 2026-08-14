"use client";

import { useActionState, useState } from "react";
import { createBundle, type ActionState } from "@/actions/items";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";

type Item = { id: string; name: string; sku: string };

const initialState: ActionState = { error: null };

export function BundleForm({ items }: { items: Item[] }) {
  const [state, formAction, pending] = useActionState(createBundle, initialState);
  const [rowCount, setRowCount] = useState(2);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <TextField label="SKU" name="sku" required />
        <TextField label="Name" name="name" required />
      </div>

      <TextField
        label="Bundle price"
        name="bundlePrice"
        type="number"
        step="0.01"
        required
        className="max-w-[200px]"
      />

      <div className="space-y-2">
        <span className="block text-sm font-medium text-on-surface-variant">
          Constituent items
        </span>
        <div className="grid grid-cols-[1fr_96px] gap-3 text-xs font-medium text-on-surface-variant">
          <span>Item</span>
          <span>Quantity</span>
        </div>
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} className="grid grid-cols-[1fr_96px] gap-3">
            <SelectField label="" name="itemId" required>
              <option value="">Select an item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </SelectField>
            <TextField
              label=""
              name="quantity"
              type="number"
              min={1}
              defaultValue={1}
              required
            />
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
        {pending ? "Saving…" : "Create bundle"}
      </Button>
    </form>
  );
}
