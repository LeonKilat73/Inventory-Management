"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/actions/items";
import { previewNextSku } from "@/actions/categories";
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

  // Auto-fill only applies to new items -- editing an existing item keeps
  // its SKU as a plain manual field.
  const isCreate = !defaults?.id;
  const [categoryId, setCategoryId] = useState(defaults?.category_id ?? "");
  const [sku, setSku] = useState(defaults?.sku ?? "");
  const [skuAuto, setSkuAuto] = useState(isCreate);

  // Driven directly by the select's change event rather than an effect on
  // categoryId, since this is a one-shot reaction to a user interaction, not
  // an ongoing sync -- also lets a request-id guard cheaply ignore a stale
  // preview if the category is changed again before the first fetch lands.
  const previewRequestId = useRef(0);
  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setCategoryId(value);
    if (!isCreate || !skuAuto) return;

    const requestId = ++previewRequestId.current;
    if (!value) {
      setSku("");
      return;
    }
    previewNextSku(value).then((preview) => {
      if (previewRequestId.current === requestId) setSku(preview ?? "");
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}
      {isCreate && <input type="hidden" name="skuAuto" value={skuAuto ? "true" : "false"} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <TextField
            label="SKU"
            name="sku"
            value={sku}
            onChange={(e) => {
              setSku(e.target.value);
              if (isCreate) setSkuAuto(false);
            }}
            required
          />
          {isCreate && skuAuto && (
            <p className="mt-1 text-xs text-on-surface-variant">
              {categoryId ? "Auto-generated — edit to override." : "Pick a category to auto-generate, or type your own."}
            </p>
          )}
        </div>
        <TextField label="Name" name="name" defaultValue={defaults?.name} required />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Category"
          name="categoryId"
          value={categoryId}
          onChange={handleCategoryChange}
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

      <TextAreaField
        label="Description"
        name="description"
        defaultValue={defaults?.description ?? ""}
      />

      <div className={`grid grid-cols-2 gap-4 ${isCreate ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
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
        {isCreate && (
          <TextField
            label="Qty on hand"
            name="initialQuantity"
            type="number"
            min={0}
            defaultValue={0}
          />
        )}
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
