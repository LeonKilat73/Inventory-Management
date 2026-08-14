"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/actions/items";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";

type Category = { id: string; name: string };

type ItemDefaults = {
  id?: string;
  sku?: string;
  name?: string;
  description?: string | null;
  category_id?: string | null;
  unit_cost?: number | null;
  unit_price?: number | null;
  reorder_threshold?: number;
  reorder_quantity?: number | null;
};

const initialState: ActionState = { error: null };

export function ItemForm({
  action,
  categories,
  defaults,
  submitLabel,
  onSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  categories: Category[];
  defaults?: ItemDefaults;
  submitLabel: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  // Fires once, right after a submission completes without error -- not on
  // initial mount, since wasPending only becomes true after a real submit.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      onSuccess?.();
    }
    wasPending.current = pending;
  }, [pending, state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid grid-cols-2 gap-4">
        <TextField label="SKU" name="sku" defaultValue={defaults?.sku} required />
        <TextField label="Name" name="name" defaultValue={defaults?.name} required />
      </div>

      <TextAreaField
        label="Description"
        name="description"
        defaultValue={defaults?.description ?? ""}
      />

      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Category"
          name="categoryId"
          defaultValue={defaults?.category_id ?? ""}
        >
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Unit price"
          name="unitPrice"
          type="number"
          step="0.01"
          defaultValue={defaults?.unit_price ?? undefined}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <TextField
          label="Unit cost"
          name="unitCost"
          type="number"
          step="0.01"
          defaultValue={defaults?.unit_cost ?? undefined}
        />
        <TextField
          label="Reorder threshold"
          name="reorderThreshold"
          type="number"
          defaultValue={defaults?.reorder_threshold ?? 0}
        />
        <TextField
          label="Reorder quantity"
          name="reorderQuantity"
          type="number"
          defaultValue={defaults?.reorder_quantity ?? undefined}
        />
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
