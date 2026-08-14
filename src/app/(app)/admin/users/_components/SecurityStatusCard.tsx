"use client";

import { useActionState } from "react";
import { unsuspendUser, type ActionState } from "@/actions/users";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const initialState: ActionState = { error: null };

export function SecurityStatusCard({
  userId,
  failedLoginCount,
  lockedUntil,
  isSuspended,
  passwordResetRequired,
}: {
  userId: string;
  failedLoginCount: number;
  lockedUntil: string | null;
  isSuspended: boolean;
  passwordResetRequired: boolean;
}) {
  const [state, formAction, pending] = useActionState(unsuspendUser, initialState);

  const isLocked = !isSuspended && !!lockedUntil && new Date(lockedUntil) > new Date();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {isSuspended && <Badge tone="error">Suspended</Badge>}
        {isLocked && <Badge tone="error">Temporarily locked</Badge>}
        {!isSuspended && !isLocked && <Badge tone="tertiary">No lockout</Badge>}
        <span className="text-sm text-on-surface-variant">
          {failedLoginCount} failed sign-in{failedLoginCount === 1 ? "" : "s"} on record
        </span>
      </div>

      {isLocked && lockedUntil && (
        <p className="text-sm text-on-surface-variant">
          Locked until {new Date(lockedUntil).toLocaleTimeString()} — clears automatically.
        </p>
      )}

      {isSuspended && (
        <>
          <p className="text-sm text-on-surface-variant">
            {passwordResetRequired
              ? "Waiting on the user to reset their password before this account can be reactivated."
              : "Password has been reset. You can reactivate this account now."}
          </p>
          <form action={formAction}>
            <input type="hidden" name="userId" value={userId} />
            <Button type="submit" variant="tonal" disabled={pending || passwordResetRequired}>
              {pending ? "Reactivating…" : "Unsuspend account"}
            </Button>
          </form>
          {state.error && <p className="text-sm text-error">{state.error}</p>}
        </>
      )}
    </div>
  );
}
