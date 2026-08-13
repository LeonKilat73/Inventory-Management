"use client";

import { useActionState } from "react";
import { updateUserOverrides, type ActionState } from "@/actions/users";
import { MODULES, ACTIONS } from "@/lib/auth/types";
import { Button } from "@/components/ui/Button";

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
      <div className="overflow-x-auto rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-on-surface-variant">Module</th>
              {ACTIONS.map((action) => (
                <th key={action} className="px-3 py-2 text-left font-medium text-on-surface-variant capitalize">
                  {action}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((module) => (
              <tr key={module} className="border-t border-outline-variant/60 bg-surface-container-lowest">
                <td className="px-3 py-2 font-medium capitalize text-on-surface">
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
                        className="rounded-md border border-outline bg-surface px-1.5 py-1 text-xs text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save overrides"}
      </Button>
    </form>
  );
}
