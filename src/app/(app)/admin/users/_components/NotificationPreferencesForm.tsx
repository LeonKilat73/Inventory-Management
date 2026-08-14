"use client";

import { useActionState } from "react";
import { updateNotificationPreferences, type ActionState } from "@/actions/notifications";
import { Button } from "@/components/ui/Button";

const initialState: ActionState = { error: null };

export function NotificationPreferencesForm({
  userId,
  emailEnabled,
  lowStockAlerts,
  itemModifiedAlerts,
}: {
  userId: string;
  emailEnabled: boolean;
  lowStockAlerts: boolean;
  itemModifiedAlerts: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateNotificationPreferences, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />

      <label className="flex items-center gap-2 text-sm text-on-surface">
        <input type="checkbox" name="emailEnabled" defaultChecked={emailEnabled} className="accent-primary" />
        Email me notifications (in addition to in-app)
      </label>
      <label className="flex items-center gap-2 text-sm text-on-surface">
        <input type="checkbox" name="lowStockAlerts" defaultChecked={lowStockAlerts} className="accent-primary" />
        Low stock alerts
      </label>
      <label className="flex items-center gap-2 text-sm text-on-surface">
        <input
          type="checkbox"
          name="itemModifiedAlerts"
          defaultChecked={itemModifiedAlerts}
          className="accent-primary"
        />
        Item modified alerts
      </label>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" variant="tonal" disabled={pending}>
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
