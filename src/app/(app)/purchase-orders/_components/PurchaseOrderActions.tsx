"use client";

import { useActionState, useState } from "react";
import { cancelPurchaseOrder, deletePurchaseOrder, type ActionState } from "@/actions/purchaseOrders";
import { Button } from "@/components/ui/Button";

const initialState: ActionState = { error: null };

type Pending = "cancel" | "delete" | null;

// Cancel and Delete are both easy to regret, so each asks once, inline,
// before doing anything (same two-click pattern as deleting a user).
export function PurchaseOrderActions({
  poId,
  poNumber,
  isApproved,
  status,
  hasReceipts,
  canEdit,
  canDelete,
}: {
  poId: string;
  poNumber: string;
  isApproved: boolean;
  status: string;
  hasReceipts: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [pendingConfirm, setConfirming] = useState<Pending>(null);
  const [typedNumber, setTypedNumber] = useState("");
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelPurchaseOrder, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePurchaseOrder, initialState);

  const mustTypeNumber = isApproved;
  const numberMatches = typedNumber.trim() === poNumber;

  const canCancel = canEdit && (status === "draft" || status === "submitted" || status === "partially_received");
  const canShowDelete = canDelete && !hasReceipts;
  const blockedByReceipts = canDelete && hasReceipts;

  // Once the order is cancelled the cancel prompt has done its job; fall back
  // to the plain buttons instead of leaving the card empty until a refresh.
  const confirming: Pending = pendingConfirm === "cancel" && !canCancel ? null : pendingConfirm;

  if (!canCancel && !canShowDelete && !blockedByReceipts) return null;

  const error = cancelState.error ?? deleteState.error;

  return (
    <div className="mt-5 space-y-3 border-t border-outline-variant/60 pt-4">
      {confirming === null && (
        <div className="flex flex-wrap items-center gap-4">
          {canCancel && (
            <button
              type="button"
              onClick={() => setConfirming("cancel")}
              className="text-sm text-on-surface-variant underline underline-offset-2"
            >
              Cancel order
            </button>
          )}
          {canShowDelete && (
            <button
              type="button"
              onClick={() => setConfirming("delete")}
              className="text-sm text-error underline underline-offset-2"
            >
              Delete order
            </button>
          )}
        </div>
      )}

      {confirming === "cancel" && canCancel && (
        <form action={cancelAction} className="space-y-3">
          <input type="hidden" name="id" value={poId} />
          <p className="text-sm text-on-surface">
            Cancel this order? Nothing more can be received against it. Anything already received stays in stock and on
            record.
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="tonal" disabled={cancelPending}>
              {cancelPending ? "Cancelling…" : "Yes, cancel order"}
            </Button>
            <Button type="button" variant="text" onClick={() => setConfirming(null)} disabled={cancelPending}>
              Keep it
            </Button>
          </div>
        </form>
      )}

      {confirming === "delete" && (
        <form action={deleteAction} className="space-y-3">
          <input type="hidden" name="id" value={poId} />
          <p className="text-sm text-on-surface">
            {isApproved ? "This order has been approved. " : ""}Permanently delete this order and its lines? This can&apos;t
            be undone. If it put a delivery reminder on the calendar, that goes too.
          </p>
          {mustTypeNumber && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">
                Type <span className="font-mono text-on-surface">{poNumber}</span> to confirm
              </span>
              <input
                name="confirm"
                value={typedNumber}
                onChange={(e) => setTypedNumber(e.target.value)}
                autoComplete="off"
                className="w-full max-w-xs rounded-md border border-outline bg-surface px-4 py-2.5 font-mono text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={deletePending || (mustTypeNumber && !numberMatches)}>
              {deletePending ? "Deleting…" : "Yes, delete order"}
            </Button>
            <Button type="button" variant="text" onClick={() => setConfirming(null)} disabled={deletePending}>
              Keep it
            </Button>
          </div>
        </form>
      )}

      {blockedByReceipts && confirming === null && (
        <p className="text-xs text-on-surface-variant">
          Goods have been received against this order, so it stays on record: stock and expenses depend on it.
          {canCancel ? " Cancel it to stop waiting for the rest." : ""}
        </p>
      )}

      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
