"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/actions/categories";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";

type CategoryDefaults = {
  id?: string;
  name?: string;
  parent_id?: string | null;
  sku_prefix?: string | null;
  sku_next_number?: number;
};

type ParentOption = { id: string; name: string };

const initialState: ActionState = { error: null };

export function CategoryForm({
  action,
  defaults,
  parentOptions,
  submitLabel,
  onSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: CategoryDefaults;
  parentOptions: ParentOption[];
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

      <SelectField label="Parent category (optional)" name="parentId" defaultValue={defaults?.parent_id ?? ""}>
        <option value="">None — top-level category</option>
        {parentOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>
      <p className="-mt-2 text-xs text-on-surface-variant">
        Use this for a brand under a category (e.g. &ldquo;QCY&rdquo; or &ldquo;Lenovo&rdquo; under
        &ldquo;Dash Cams&rdquo;). Its generated SKU combines both prefixes: &ldquo;DCAM&rdquo; +
        &ldquo;QCY&rdquo; → &ldquo;DCAM-QCY-0001&rdquo;.
      </p>

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
        Leave the prefix blank if items here should always get a manual SKU. Otherwise new items
        default to prefix + next number, and the number advances automatically each time it&rsquo;s used.
      </p>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
