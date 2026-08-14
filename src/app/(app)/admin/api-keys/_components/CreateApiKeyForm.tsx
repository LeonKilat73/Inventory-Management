"use client";

import { useActionState } from "react";
import { createApiKey, type ActionState } from "@/actions/apiKeys";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

const initialState: ActionState = { error: null };

export function CreateApiKeyForm() {
  const [state, formAction, pending] = useActionState(createApiKey, initialState);

  return (
    <div className="space-y-4">
      {state.rawKey && (
        <div className="rounded-lg border border-primary/40 bg-primary-container p-4">
          <p className="text-sm font-medium text-on-primary-container">
            Copy this key now -- it won&apos;t be shown again.
          </p>
          <code className="mt-2 block break-all rounded-md bg-surface px-3 py-2 text-sm text-on-surface">
            {state.rawKey}
          </code>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <TextField label="Name" name="name" placeholder="POS integration" required />
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input type="checkbox" name="canWrite" className="accent-primary" />
          Allow write access (record stock movements), not just read
        </label>

        {state.error && <p className="text-sm text-error">{state.error}</p>}

        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create API key"}
        </Button>
      </form>
    </div>
  );
}
