"use client";

import { useActionState } from "react";
import { updateUserRole, type ActionState } from "@/actions/users";

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
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">Role</span>
        <select
          name="roleId"
          defaultValue={currentRoleId}
          disabled={disabled}
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground disabled:opacity-60 dark:border-white/20"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id} className="capitalize">
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update role"}
      </button>
      {disabled && (
        <p className="text-sm text-zinc-500">
          You can&apos;t change your own role — ask another admin.
        </p>
      )}
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
