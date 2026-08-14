"use client";

import { useActionState, useState } from "react";
import { deleteUserAccount, type ActionState } from "@/actions/users";
import { Button } from "@/components/ui/Button";

const initialState: ActionState = { error: null };

export function DeleteAccountButton({ userId, fullName }: { userId: string; fullName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteUserAccount, initialState);

  if (!confirming) {
    return (
      <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
        Delete account
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-error/40 bg-error-container/30 p-4">
      <p className="text-sm text-on-surface">
        This permanently deletes <strong>{fullName}</strong>&apos;s account and sign-in. It only
        succeeds if they have no purchase orders, stock movements, audit history, or other records
        tied to them — otherwise, use Deactivate above instead.
      </p>
      <div className="flex items-center gap-3">
        <form action={formAction}>
          <input type="hidden" name="userId" value={userId} />
          <Button type="submit" variant="danger" disabled={pending}>
            {pending ? "Deleting…" : "Yes, permanently delete"}
          </Button>
        </form>
        <Button type="button" variant="text" onClick={() => setConfirming(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
    </div>
  );
}
