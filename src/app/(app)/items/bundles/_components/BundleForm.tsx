"use client";

import { useActionState, useState } from "react";
import { createBundle, type ActionState } from "@/actions/items";

type Item = { id: string; name: string; sku: string };

const initialState: ActionState = { error: null };

export function BundleForm({ items }: { items: Item[] }) {
  const [state, formAction, pending] = useActionState(createBundle, initialState);
  const [rowCount, setRowCount] = useState(2);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">SKU</span>
          <input
            name="sku"
            required
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">Name</span>
          <input
            name="name"
            required
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">Bundle price</span>
        <input
          name="bundlePrice"
          type="number"
          step="0.01"
          required
          className="w-full max-w-[200px] rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20"
        />
      </label>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-foreground">
          Constituent items
        </span>
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <select
              name="itemId"
              required
              className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20"
            >
              <option value="">Select an item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </select>
            <input
              name="quantity"
              type="number"
              min={1}
              defaultValue={1}
              required
              className="w-24 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRowCount((n) => n + 1)}
          className="text-sm text-zinc-500 underline underline-offset-2 hover:text-foreground"
        >
          + Add another item
        </button>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "Saving…" : "Create bundle"}
      </button>
    </form>
  );
}
