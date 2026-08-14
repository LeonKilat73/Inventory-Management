"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createBundle, type ActionState } from "@/actions/items";
import { previewNextSku } from "@/actions/categories";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";

type Item = { id: string; name: string; sku: string };
type Category = { id: string; name: string };

const initialState: ActionState = { error: null };

export function BundleForm({
  items,
  categories,
  onSuccess,
}: {
  items: Item[];
  categories: Category[];
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(createBundle, initialState);
  const [rowCount, setRowCount] = useState(2);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      onSuccess?.();
    }
    wasPending.current = pending;
  }, [pending, state, onSuccess]);

  const [categoryId, setCategoryId] = useState("");
  const [sku, setSku] = useState("");
  const [skuAuto, setSkuAuto] = useState(true);

  const previewRequestId = useRef(0);
  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setCategoryId(value);
    if (!skuAuto) return;

    const requestId = ++previewRequestId.current;
    if (!value) {
      setSku("");
      return;
    }
    previewNextSku(value, "bundles").then((preview) => {
      if (previewRequestId.current === requestId) setSku(preview ?? "");
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="skuAuto" value={skuAuto ? "true" : "false"} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <TextField
            label="SKU"
            name="sku"
            value={sku}
            onChange={(e) => {
              setSku(e.target.value);
              setSkuAuto(false);
            }}
            required
          />
          {skuAuto && (
            <p className="mt-1 text-xs text-on-surface-variant">
              {categoryId ? "Auto-generated — edit to override." : "Pick a category to auto-generate, or type your own."}
            </p>
          )}
        </div>
        <TextField label="Name" name="name" required />
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
          required
        />
      </div>

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
