"use client";

import { useActionState } from "react";
import { updateRolePermissions, type ActionState } from "@/actions/roles";
import { MODULES, ACTIONS } from "@/lib/auth/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
    <Card>
      <h3 className="mb-3 font-medium capitalize text-on-surface">
        {roleName}
        {readOnly && (
          <span className="ml-2 text-xs font-normal text-on-surface-variant">
            (always full access)
          </span>
        )}
      </h3>
      <form action={formAction}>
        <input type="hidden" name="roleId" value={roleId} />
        <div className="overflow-x-auto rounded-xl border border-outline-variant/60">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-high">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-on-surface-variant">Module</th>
                {ACTIONS.map((action) => (
                  <th key={action} className="px-2 py-2 text-center font-medium text-on-surface-variant capitalize">
                    {action}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((module) => (
                <tr key={module} className="border-t border-outline-variant/60">
                  <td className="px-3 py-1.5 capitalize text-on-surface">{module.replace("_", " ")}</td>
                  {ACTIONS.map((action) => (
                    <td key={action} className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        name={`perm__${module}__${action}`}
                        defaultChecked={readOnly || defaults[module]?.[action] === true}
                        disabled={readOnly}
                        className="accent-primary"
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
            <Button type="submit" variant="tonal" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            {state.error && <p className="text-sm text-error">{state.error}</p>}
          </div>
        )}
      </form>
    </Card>
  );
}
