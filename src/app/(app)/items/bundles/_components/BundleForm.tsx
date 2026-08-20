"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/actions/items";
import { previewNextSku } from "@/actions/categories";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";

type Item = { id: string; name: string; sku: string };
type Category = { id: string; name: string };

type BundleDefaults = {
  id?: string;
  sku?: string;
  name?: string;
  categoryId?: string | null;
  bundlePrice?: number;
  constituents?: Array<{ itemId: string; quantity: number }>;
};

type ConstituentRow = { key: number; itemId?: string; quantity?: number };

export function BundleForm({
  action,
  items,
  categories,
  defaults,
  submitLabel,
  onSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  items: Item[];
  categories: Category[];
  defaults?: BundleDefaults;
  submitLabel: string;
  onSuccess?: () => void;
}) {
  const initialState: ActionState = { error: null };
  const [state, formAction, pending] = useActionState(action, initialState);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      onSuccess?.();
    }
    wasPending.current = pending;
  }, [pending, state, onSuccess]);

  // Auto-fill only applies to new bundles -- editing an existing one keeps
  // its SKU as a plain manual field, same convention as ItemForm.
  const isCreate = !defaults?.id;
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? "");
  const [sku, setSku] = useState(defaults?.sku ?? "");
  const [skuAuto, setSkuAuto] = useState(isCreate);

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
    previewNextSku(value, "bundles").then((preview) => {
      if (previewRequestId.current === requestId) setSku(preview ?? "");
    });
  }

  const initialRows: ConstituentRow[] = defaults?.constituents?.length
    ? defaults.constituents.map((c, i) => ({ key: i, itemId: c.itemId, quantity: c.quantity }))
    : [{ key: 0 }, { key: 1 }];
  const nextKey = useRef(initialRows.length);
  const [rows, setRows] = useState<ConstituentRow[]>(initialRows);

  function addRow() {
    setRows((r) => [...r, { key: nextKey.current++ }]);
  }
  function removeRow(key: number) {
    setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));
  }

  return (
    <form action={formAction} className="space-y-4">
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}
      {isCreate && <input type="hidden" name="skuAuto" value={skuAuto ? "true" : "false"} />}

      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Category" name="categoryId" value={categoryId} onChange={handleCategoryChange}>
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Bundle price"
          name="bundlePrice"
          type="number"
          step="0.01"
          defaultValue={defaults?.bundlePrice}
          required
        />
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-on-surface-variant">
          Constituent items
        </span>
        <div className="grid grid-cols-[1fr_96px_auto] gap-3 text-xs font-medium text-on-surface-variant">
          <span>Item</span>
          <span>Quantity</span>
          <span />
        </div>
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[1fr_96px_auto] items-center gap-3">
            <SelectField label="" name="itemId" defaultValue={row.itemId ?? ""} required>
              <option value="">Select an item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </SelectField>
            <TextField label="" name="quantity" type="number" min={1} defaultValue={row.quantity ?? 1} required />
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              disabled={rows.length === 1}
              className="text-sm text-error underline underline-offset-2 disabled:pointer-events-none disabled:opacity-30"
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addRow} className="text-sm text-primary underline underline-offset-2">
          + Add another item
        </button>
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
