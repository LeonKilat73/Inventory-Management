"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteItem, setItemActive, type ActionState } from "@/actions/items";

const initialState: ActionState = { error: null };

export function ItemRowActions({
  itemId,
  isActive,
  canEdit,
  canDelete,
}: {
  itemId: string;
  isActive: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [deleteState, deleteAction, deletePending] = useActionState(deleteItem, initialState);
  const [activeState, activeAction, activePending] = useActionState(setItemActive, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-4">
        {canEdit && (
          <Link href={`/items/${itemId}`} className="text-primary underline underline-offset-2">
            Edit
          </Link>
        )}
        {canDelete && (
          <form action={activeAction}>
            <input type="hidden" name="id" value={itemId} />
            <input type="hidden" name="active" value={(!isActive).toString()} />
            <button
              type="submit"
              disabled={activePending}
              className="text-on-surface-variant underline underline-offset-2 disabled:opacity-50"
            >
              {activePending ? "…" : isActive ? "Deactivate" : "Reactivate"}
            </button>
          </form>
        )}
        {canDelete && (
          <form action={deleteAction}>
            <input type="hidden" name="id" value={itemId} />
            <button
              type="submit"
              disabled={deletePending}
              className="text-error underline underline-offset-2 disabled:opacity-50"
            >
              {deletePending ? "…" : "Delete"}
            </button>
          </form>
        )}
      </div>
      {deleteState.error && <p className="max-w-[240px] text-right text-xs text-error">{deleteState.error}</p>}
      {activeState.error && <p className="max-w-[240px] text-right text-xs text-error">{activeState.error}</p>}
    </div>
  );
}
