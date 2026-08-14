"use client";

import { useActionState } from "react";
import { updateUsername, type ActionState } from "@/actions/users";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

const initialState: ActionState = { error: null };

export function UsernameForm({ userId, username }: { userId: string; username: string | null }) {
  const [state, formAction, pending] = useActionState(updateUsername, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="userId" value={userId} />
      <TextField
        label="Username"
        name="username"
        defaultValue={username ?? ""}
        placeholder="not set"
        pattern="[a-z0-9_.]{3,32}"
        title="3-32 characters: lowercase letters, numbers, underscore, or period"
        className="w-48"
        required
      />
      <Button type="submit" variant="tonal" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
    </form>
  );
}
