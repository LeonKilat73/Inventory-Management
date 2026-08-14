"use client";

import { useActionState } from "react";
import { resolveDefectiveItem, type ActionState } from "@/actions/defectiveItems";
import { Button } from "@/components/ui/Button";

const initialState: ActionState = { error: null };

const RESOLUTION_LABELS: Record<string, string> = {
  restocked: "Restock (was fine after all)",
  replaced: "Replaced with a new unit",
  returned_to_supplier: "Returned to supplier",
  written_off: "Write off",
};

export function ResolveForm({ defectiveId }: { defectiveId: string }) {
  const [state, formAction, pending] = useActionState(resolveDefectiveItem, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="defectiveId" value={defectiveId} />
      <select
        name="resolution"
        required
        className="rounded-md border border-outline bg-surface px-2 py-1.5 text-xs text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <option value="">Resolve as…</option>
        {Object.entries(RESOLUTION_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <Button type="submit" variant="tonal" disabled={pending} className="!px-4 !py-1.5 text-xs">
        {pending ? "Saving…" : "Resolve"}
      </Button>
      {state.error && <span className="text-xs text-error">{state.error}</span>}
    </form>
  );
}
