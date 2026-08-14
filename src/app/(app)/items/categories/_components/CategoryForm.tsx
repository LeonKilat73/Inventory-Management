"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/actions/categories";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

type CategoryDefaults = {
  id?: string;
  name?: string;
  sku_prefix?: string | null;
  sku_next_number?: number;
};

const initialState: ActionState = { error: null };

export function CategoryForm({
  action,
  defaults,
  submitLabel,
  onSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: CategoryDefaults;
  submitLabel: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

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

      <TextField label="Category name" name="name" defaultValue={defaults?.name} required />

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="SKU prefix"
          name="skuPrefix"
          defaultValue={defaults?.sku_prefix ?? ""}
          placeholder="e.g. DCAM"
          maxLength={10}
          style={{ textTransform: "uppercase" }}
        />
        <TextField
          label="Next SKU number"
          name="skuNextNumber"
          type="number"
          min={1}
          defaultValue={defaults?.sku_next_number ?? 1}
        />
      </div>
      <p className="text-xs text-on-surface-variant">
        Leave the prefix blank if items in this category should always get a manual SKU. Otherwise new
        items default to prefix + next number (e.g. &ldquo;DCAM&rdquo; + 2101 → &ldquo;DCAM-2101&rdquo;),
        and the number advances automatically each time it&rsquo;s used.
      </p>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
