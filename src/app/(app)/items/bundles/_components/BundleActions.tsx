"use client";

import { useActionState } from "react";
import { deleteBundle, setBundleActive, type ActionState } from "@/actions/items";

const initialState: ActionState = { error: null };

export function BundleActions({
  bundleId,
  isActive,
  canDelete,
}: {
  bundleId: string;
  isActive: boolean;
  canDelete: boolean;
}) {
  const [deleteState, deleteAction, deletePending] = useActionState(deleteBundle, initialState);
  const [activeState, activeAction, activePending] = useActionState(setBundleActive, initialState);

  if (!canDelete) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-4">
        <form action={activeAction}>
          <input type="hidden" name="id" value={bundleId} />
          <input type="hidden" name="active" value={(!isActive).toString()} />
          <button
            type="submit"
            disabled={activePending}
            className="text-sm text-on-surface-variant underline underline-offset-2 disabled:opacity-50"
          >
            {activePending ? "…" : isActive ? "Deactivate" : "Reactivate"}
          </button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={bundleId} />
          <button
            type="submit"
            disabled={deletePending}
            className="text-sm text-error underline underline-offset-2 disabled:opacity-50"
          >
            {deletePending ? "…" : "Delete"}
          </button>
        </form>
      </div>
      {deleteState.error && <p className="max-w-[240px] text-right text-xs text-error">{deleteState.error}</p>}
      {activeState.error && <p className="max-w-[240px] text-right text-xs text-error">{activeState.error}</p>}
    </div>
  );
}
