"use client";

import { useActionState } from "react";
import { updateUserOverrides, type ActionState } from "@/actions/users";
import { MODULES, ACTIONS } from "@/lib/auth/types";

const initialState: ActionState = { error: null };

type OverrideValue = "inherit" | "grant" | "revoke";

export function OverrideGrid({
  userId,
  roleDefaults,
  overrides,
}: {
  userId: string;
  // role default for each module/action, before overrides
  roleDefaults: Record<string, Record<string, boolean>>;
  // existing explicit overrides for this user
  overrides: Record<string, Record<string, boolean>>;
}) {
  const [state, formAction, pending] = useActionState(updateUserOverrides, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-zinc-500">Module</th>
              {ACTIONS.map((action) => (
                <th key={action} className="px-3 py-2 text-left font-medium text-zinc-500 capitalize">
                  {action}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((module) => (
              <tr key={module} className="border-t border-black/10 dark:border-white/10">
                <td className="px-3 py-2 font-medium capitalize text-foreground">
                  {module.replace("_", " ")}
                </td>
                {ACTIONS.map((action) => {
                  const roleDefault = roleDefaults[module]?.[action] === true;
                  const hasOverride = overrides[module]?.[action] !== undefined;
                  const overrideValue = overrides[module]?.[action];
                  const defaultSelectValue: OverrideValue = hasOverride
                    ? overrideValue
                      ? "grant"
                      : "revoke"
                    : "inherit";

                  return (
                    <td key={action} className="px-3 py-2">
                      <select
                        name={`override__${module}__${action}`}
                        defaultValue={defaultSelectValue}
                        className="rounded border border-black/15 bg-transparent px-1.5 py-1 text-xs outline-none focus:border-foreground dark:border-white/20"
                      >
                        <option value="inherit">
                          Default ({roleDefault ? "yes" : "no"})
                        </option>
                        <option value="grant">Grant</option>
                        <option value="revoke">Revoke</option>
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save overrides"}
      </button>
    </form>
  );
}
