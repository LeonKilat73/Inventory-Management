"use client";

import { useActionState } from "react";
import { setUserActive, setUserLocked, sendPasswordResetEmail, type ActionState } from "@/actions/users";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const initialState: ActionState = { error: null };

export function AccountActionsCard({
  userId,
  isActive,
  adminLocked,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  adminLocked: boolean;
  isSelf: boolean;
}) {
  const [activeState, activeAction, activePending] = useActionState(setUserActive, initialState);
  const [lockState, lockAction, lockPending] = useActionState(setUserLocked, initialState);
  const [resetState, resetAction, resetPending] = useActionState(sendPasswordResetEmail, initialState);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={isActive ? "tertiary" : "neutral"}>{isActive ? "Active" : "Deactivated"}</Badge>
        <Badge tone={adminLocked ? "error" : "tertiary"}>{adminLocked ? "Locked by admin" : "Not locked"}</Badge>
      </div>

      {isSelf && (
        <p className="text-sm text-on-surface-variant">
          You can&apos;t deactivate or lock your own account — ask another admin.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {!isSelf && (
          <form action={activeAction}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="active" value={(!isActive).toString()} />
            <Button type="submit" variant="tonal" disabled={activePending}>
              {activePending ? "Saving…" : isActive ? "Deactivate account" : "Reactivate account"}
            </Button>
          </form>
        )}

        {!isSelf && (
          <form action={lockAction}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="locked" value={(!adminLocked).toString()} />
            <Button type="submit" variant="tonal" disabled={lockPending}>
              {lockPending ? "Saving…" : adminLocked ? "Unlock account" : "Lock account"}
            </Button>
          </form>
        )}

        <form action={resetAction}>
          <input type="hidden" name="userId" value={userId} />
          <Button type="submit" variant="outlined" disabled={resetPending}>
            {resetPending ? "Sending…" : "Send password reset email"}
          </Button>
        </form>
      </div>

      {activeState.error && <p className="text-sm text-error">{activeState.error}</p>}
      {lockState.error && <p className="text-sm text-error">{lockState.error}</p>}
      {resetState.error && <p className="text-sm text-error">{resetState.error}</p>}
      {resetState.info && <p className="text-sm text-tertiary">{resetState.info}</p>}
    </div>
  );
}
