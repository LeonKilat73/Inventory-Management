"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteSupplier, setSupplierActive, type ActionState } from "@/actions/suppliers";

const initialState: ActionState = { error: null };

export function SupplierRowActions({
  supplierId,
  isActive,
  canEdit,
  canDelete,
}: {
  supplierId: string;
  isActive: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSupplier, initialState);
  const [activeState, activeAction, activePending] = useActionState(setSupplierActive, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-4">
        {canEdit && (
          <Link href={`/suppliers/${supplierId}`} className="text-primary underline underline-offset-2">
            Edit
          </Link>
        )}
        {canEdit && (
          <form action={activeAction}>
            <input type="hidden" name="id" value={supplierId} />
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
            <input type="hidden" name="id" value={supplierId} />
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
      {deleteState.error && <p className="max-w-[260px] text-right text-xs text-error">{deleteState.error}</p>}
      {activeState.error && <p className="max-w-[260px] text-right text-xs text-error">{activeState.error}</p>}
    </div>
  );
}
