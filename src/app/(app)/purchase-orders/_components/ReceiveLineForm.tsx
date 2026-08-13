"use client";

import { useActionState } from "react";
import { receivePurchaseOrderLine, type ActionState } from "@/actions/purchaseOrders";
import { Button } from "@/components/ui/Button";

const initialState: ActionState = { error: null };

export function ReceiveLineForm({
  poId,
  lineId,
  remaining,
}: {
  poId: string;
  lineId: string;
  remaining: number;
}) {
  const [state, formAction, pending] = useActionState(receivePurchaseOrderLine, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="poId" value={poId} />
      <input type="hidden" name="lineId" value={lineId} />
      <input
        name="quantity"
        type="number"
        min={1}
        max={remaining}
        defaultValue={remaining}
        className="w-20 rounded-md border border-outline bg-surface px-2 py-1.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <Button type="submit" variant="tonal" disabled={pending} className="!px-4 !py-1.5 text-xs">
        {pending ? "Receiving…" : "Receive"}
      </Button>
      {state.error && <span className="text-xs text-error">{state.error}</span>}
    </form>
  );
}
