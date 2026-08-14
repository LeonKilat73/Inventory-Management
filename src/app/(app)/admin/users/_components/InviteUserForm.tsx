"use client";

import { useActionState } from "react";
import { inviteUser, type ActionState } from "@/actions/users";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";

type Role = { id: string; name: string };

const initialState: ActionState = { error: null };

export function InviteUserForm({ roles }: { roles: Role[] }) {
  const [state, formAction, pending] = useActionState(inviteUser, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Full name" name="fullName" required />
        <TextField label="Email" name="email" type="email" required />
      </div>

      <SelectField label="Role" name="roleId" required defaultValue="">
        <option value="" disabled>
          Select a role…
        </option>
        {roles.map((r) => (
          <option key={r.id} value={r.id} className="capitalize">
            {r.name}
          </option>
        ))}
      </SelectField>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Sending invite…" : "Invite user"}
      </Button>
      <p className="text-xs text-on-surface-variant">
        They&apos;ll get an email to set their own password. You can fine-tune
        individual permissions afterward from their user page.
      </p>
    </form>
  );
}
