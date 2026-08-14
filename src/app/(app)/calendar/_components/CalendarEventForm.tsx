"use client";

import { useActionState } from "react";
import { createCalendarEvent, type ActionState } from "@/actions/calendarEvents";
import { EVENT_TYPES } from "@/lib/validation/calendarEvent";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";

type Supplier = { id: string; name: string };

const initialState: ActionState = { error: null };

const TYPE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  restock_task: "Restock task",
  supplier_meeting: "Supplier meeting",
  other: "Other",
};

export function CalendarEventForm({ suppliers }: { suppliers: Supplier[] }) {
  const [state, formAction, pending] = useActionState(createCalendarEvent, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <TextField label="Title" name="title" required />

      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Type" name="eventType" defaultValue="other">
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Related supplier (optional)" name="relatedSupplierId">
          <option value="">None</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField label="Starts" name="startsAt" type="datetime-local" required />
        <TextField label="Ends (optional)" name="endsAt" type="datetime-local" />
      </div>

      <TextAreaField label="Notes" name="notes" />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add event"}
      </Button>
    </form>
  );
}
