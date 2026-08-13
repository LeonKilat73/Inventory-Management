"use client";

import { useActionState } from "react";
import type { ActionState } from "@/actions/suppliers";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/Field";

type SupplierDefaults = {
  id?: string;
  name?: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

const initialState: ActionState = { error: null };

export function SupplierForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: SupplierDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}

      <TextField label="Name" name="name" defaultValue={defaults?.name} required />

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Contact name"
          name="contactName"
          defaultValue={defaults?.contact_name ?? ""}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          defaultValue={defaults?.email ?? ""}
        />
      </div>

      <TextField label="Phone" name="phone" defaultValue={defaults?.phone ?? ""} />
      <TextAreaField
        label="Address"
        name="address"
        defaultValue={defaults?.address ?? ""}
      />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
