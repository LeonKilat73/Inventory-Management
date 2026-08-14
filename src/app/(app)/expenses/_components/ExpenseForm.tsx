"use client";

import { useActionState } from "react";
import { createExpense, type ActionState } from "@/actions/expenses";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

const initialState: ActionState = { error: null };

export function ExpenseForm() {
  const [state, formAction, pending] = useActionState(createExpense, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Amount" name="amount" type="number" step="0.01" min={0} required />
        <TextField label="Date" name="incurredAt" type="date" defaultValue={today} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Category" name="category" placeholder="rent, shipping, other" />
        <TextField label="Description" name="description" />
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add expense"}
      </Button>
    </form>
  );
}
