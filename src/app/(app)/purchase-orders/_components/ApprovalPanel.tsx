"use client";

import { useActionState, useState } from "react";
import { decidePurchaseOrderApproval, resendApprovalEmail, type ActionState } from "@/actions/purchaseOrders";
import { approvalLabel, type ApprovalStatus } from "@/lib/purchaseOrders/approvalLabel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/Field";

const initialState: ActionState = { error: null };

// Dates arrive pre-formatted from the server so the server render and the
// browser can never disagree on locale or timezone output.
export function ApprovalPanel({
  poId,
  status,
  approverEmail,
  requestedLabel,
  decidedLabel,
  note,
  emailSentLabel,
  canDecide,
  canResend,
  viewerIsCreator,
}: {
  poId: string;
  status: ApprovalStatus;
  approverEmail: string | null;
  requestedLabel: string | null;
  decidedLabel: string | null;
  note: string | null;
  emailSentLabel: string | null;
  canDecide: boolean;
  canResend: boolean;
  viewerIsCreator: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [decideState, decideAction, decidePending] = useActionState(decidePurchaseOrderApproval, initialState);
  const [resendState, resendAction, resendPending] = useActionState(resendApprovalEmail, initialState);

  if (!status) return null;
  const label = approvalLabel(status);

  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-medium text-on-surface">Approval</h2>
        <Badge tone={label.tone}>{label.text}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-on-surface-variant">Sent to</dt>
          <dd className="break-all text-on-surface">{approverEmail ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Requested</dt>
          <dd className="text-on-surface">{requestedLabel ?? "—"}</dd>
        </div>
        {decidedLabel && (
          <div>
            <dt className="text-on-surface-variant">{status === "approved" ? "Approved" : "Rejected"}</dt>
            <dd className="text-on-surface">{decidedLabel}</dd>
          </div>
        )}
        {note && (
          <div className="sm:col-span-2">
            <dt className="text-on-surface-variant">Reason</dt>
            <dd className="text-on-surface">{note}</dd>
          </div>
        )}
      </dl>

      {status === "pending" && (
        <div className="mt-4 space-y-3 border-t border-outline-variant/60 pt-4">
          <p className="text-sm text-on-surface-variant">
            {emailSentLabel
              ? `Approval request emailed ${emailSentLabel}.`
              : "The approver has been notified in the app. The email hasn't gone out yet."}
            {viewerIsCreator && " You can't approve your own order."}
          </p>

          {canResend && (
            <form action={resendAction}>
              <input type="hidden" name="id" value={poId} />
              <button
                type="submit"
                disabled={resendPending}
                className="text-sm text-primary underline underline-offset-2 disabled:opacity-50"
              >
                {resendPending ? "Sending…" : "Resend approval email"}
              </button>
            </form>
          )}
          {resendState.error && <p className="text-sm text-error">{resendState.error}</p>}
          {!resendState.error && resendState.notice && (
            <p className="text-sm text-on-surface-variant">{resendState.notice}</p>
          )}

          {canDecide && !rejecting && (
            <div className="flex flex-wrap gap-2">
              <form action={decideAction}>
                <input type="hidden" name="id" value={poId} />
                <input type="hidden" name="decision" value="approved" />
                <Button type="submit" disabled={decidePending}>
                  {decidePending ? "Saving…" : "Approve"}
                </Button>
              </form>
              <Button type="button" variant="outlined" onClick={() => setRejecting(true)} disabled={decidePending}>
                Reject
              </Button>
            </div>
          )}

          {canDecide && rejecting && (
            <form action={decideAction} className="space-y-3">
              <input type="hidden" name="id" value={poId} />
              <input type="hidden" name="decision" value="rejected" />
              <TextAreaField label="Why are you rejecting this order?" name="note" required />
              <div className="flex gap-2">
                <Button type="submit" variant="danger" disabled={decidePending}>
                  {decidePending ? "Saving…" : "Confirm reject"}
                </Button>
                <Button type="button" variant="text" onClick={() => setRejecting(false)} disabled={decidePending}>
                  Back
                </Button>
              </div>
            </form>
          )}

          {decideState.error && <p className="text-sm text-error">{decideState.error}</p>}
        </div>
      )}
    </div>
  );
}
