"use client";

import { useActionState } from "react";
import type { ActionState } from "@/actions/items";

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
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  categories: Category[];
  defaults?: ItemDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid grid-cols-2 gap-4">
        <TextField label="SKU" name="sku" defaultValue={defaults?.sku} required />
        <TextField label="Name" name="name" defaultValue={defaults?.name} required />
      </div>

      <TextField
        label="Description"
        name="description"
        defaultValue={defaults?.description ?? ""}
        textarea
      />

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">Category</span>
          <select
            name="categoryId"
            defaultValue={defaults?.category_id ?? ""}
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20"
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
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

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  type = "text",
  step,
  required,
  textarea,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  step?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const className =
    "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20";

  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-foreground">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={3}
          className={className}
        />
      ) : (
        <input
          name={name}
          type={type}
          step={step}
          defaultValue={defaultValue}
          required={required}
          className={className}
        />
      )}
    </label>
  );
}
