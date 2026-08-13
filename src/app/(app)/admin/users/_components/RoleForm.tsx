"use client";

import { useActionState } from "react";
import { updateUserRole, type ActionState } from "@/actions/users";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";

type Role = { id: string; name: string };

const initialState: ActionState = { error: null };

export function RoleForm({
  userId,
  currentRoleId,
  roles,
  disabled,
}: {
  userId: string;
  currentRoleId: string;
  roles: Role[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateUserRole, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="userId" value={userId} />
      <SelectField
        label="Role"
        name="roleId"
        defaultValue={currentRoleId}
        disabled={disabled}
        className="w-48"
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id} className="capitalize">
            {r.name}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="tonal" disabled={disabled || pending}>
        {pending ? "Saving…" : "Update role"}
      </Button>
      {disabled && (
        <p className="text-sm text-on-surface-variant">
          You can&apos;t change your own role — ask another admin.
        </p>
      )}
      {state.error && <p className="text-sm text-error">{state.error}</p>}
    </form>
  );
}
