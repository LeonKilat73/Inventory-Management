"use client";

import { useActionState, useState } from "react";
import { recordStockMovement, type ActionState } from "@/actions/stockMovements";
import { Button } from "@/components/ui/Button";

const initialState: ActionState = { error: null };

export function QuickAdjustStockForm({ itemId, currentStock }: { itemId: string; currentStock: number }) {
  const [state, formAction, pending] = useActionState(recordStockMovement, initialState);
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");

  return (
    <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-on-surface-variant">Current stock</span>
        <span className="text-2xl font-medium text-on-surface">{currentStock}</span>
      </div>

      <form action={formAction} className="mt-3 flex items-end gap-2">
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="movementType" value="manual_adjustment" />
        <input type="hidden" name="direction" value={direction} />

        <label className="text-sm">
          <span className="mb-1 block text-xs text-on-surface-variant">Direction</span>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "increase" | "decrease")}
            className="rounded-md border border-outline bg-surface px-2 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="increase">Add</option>
            <option value="decrease">Remove</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-xs text-on-surface-variant">Quantity</span>
          <input
            name="quantity"
            type="number"
            min={1}
            required
            className="w-20 rounded-md border border-outline bg-surface px-2 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="flex-1 text-sm">
          <span className="mb-1 block text-xs text-on-surface-variant">Note (optional)</span>
          <input
            name="note"
            className="w-full rounded-md border border-outline bg-surface px-2 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <Button type="submit" variant="tonal" disabled={pending} className="!px-4 !py-2 text-xs">
          {pending ? "Saving…" : "Adjust"}
        </Button>
      </form>

      {state.error && <p className="mt-2 text-sm text-error">{state.error}</p>}
      <p className="mt-2 text-xs text-on-surface-variant">
        For sales, receiving purchase orders, or defective items, use their own pages
        instead — this is for plain corrections (e.g. a recount).
      </p>
    </div>
  );
}
