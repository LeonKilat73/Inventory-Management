"use client";

import { useActionState } from "react";
import { updateRolePermissions, type ActionState } from "@/actions/roles";
import { MODULES, ACTIONS } from "@/lib/auth/types";

const initialState: ActionState = { error: null };

export function RolePermissionForm({
  roleId,
  roleName,
  defaults,
  readOnly,
}: {
  roleId: string;
  roleName: string;
  defaults: Record<string, Record<string, boolean>>;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateRolePermissions, initialState);

  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <h3 className="mb-3 font-medium capitalize text-foreground">
        {roleName}
        {readOnly && <span className="ml-2 text-xs font-normal text-zinc-500">(always full access)</span>}
      </h3>
      <form action={formAction}>
        <input type="hidden" name="roleId" value={roleId} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-1 text-left font-medium text-zinc-500">Module</th>
                {ACTIONS.map((action) => (
                  <th key={action} className="px-2 py-1 text-center font-medium text-zinc-500 capitalize">
                    {action}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((module) => (
                <tr key={module} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-3 py-1 capitalize text-foreground">{module.replace("_", " ")}</td>
                  {ACTIONS.map((action) => (
                    <td key={action} className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        name={`perm__${module}__${action}`}
                        defaultChecked={readOnly || defaults[module]?.[action] === true}
                        disabled={readOnly}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
          </div>
        )}
      </form>
    </div>
  );
}
