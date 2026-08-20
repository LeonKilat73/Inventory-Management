"use client";

import { useActionState } from "react";
import { runSyncNow, applyPendingChange, dismissPendingChange, type PendingChange } from "@/actions/quickbooksSync";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const CHANGE_TYPE_LABEL: Record<PendingChange["change_type"], string> = {
  new_item: "New item",
  new_bundle: "New bundle",
  updated_item: "Updated",
  deactivated: "Deactivated",
};

function money(value: unknown): string {
  return typeof value === "number" ? `₱${value.toFixed(2)}` : "—";
}

function describeDiff(diff: Record<string, { from: unknown; to: unknown }> | undefined): string[] {
  if (!diff) return [];
  const lines: string[] = [];
  if (diff.name) lines.push(`Name "${diff.name.from}" → "${diff.name.to}"`);
  if (diff.unitPrice) lines.push(`Price ${money(diff.unitPrice.from)} → ${money(diff.unitPrice.to)}`);
  if (diff.unitCost) lines.push(`Cost ${money(diff.unitCost.from)} → ${money(diff.unitCost.to)}`);
  if (diff.reorderThreshold) lines.push(`Reorder point ${diff.reorderThreshold.from} → ${diff.reorderThreshold.to}`);
  if (diff.stock) lines.push(`Stock ${diff.stock.from} → ${diff.stock.to}`);
  if (diff.isActive) lines.push(diff.isActive.to === false ? "Marked inactive in QuickBooks" : "Marked active in QuickBooks");
  return lines;
}

function describeNew(change: PendingChange): string[] {
  const p = change.payload;
  if (change.change_type === "new_bundle") {
    const constituents = (p.constituents as Array<{ name: string; quantity: number }> | undefined) ?? [];
    return [
      `Price ${money(p.bundlePrice)}`,
      `Parts: ${constituents.map((c) => `${c.name} ×${c.quantity}`).join(", ")}`,
    ];
  }
  const lines = [`Price ${money(p.unitPrice)}`, `Cost ${money(p.unitCost)}`];
  if (p.tracksQty) lines.push(`Starting stock ${p.qtyOnHand}`);
  return lines;
}

function PendingChangeRow({ change }: { change: PendingChange }) {
  const [applyState, applyAction, applyPending] = useActionState(
    async () => applyPendingChange(change.id),
    { error: null } as { error: string | null },
  );
  const [dismissState, dismissAction, dismissPending] = useActionState(
    async () => dismissPendingChange(change.id),
    { error: null } as { error: string | null },
  );

  const lines = change.change_type === "new_item" || change.change_type === "new_bundle"
    ? describeNew(change)
    : describeDiff(change.payload.diff as Record<string, { from: unknown; to: unknown }> | undefined);

  const busy = applyPending || dismissPending;
  const error = applyState.error ?? dismissState.error;

  return (
    <li className="flex flex-col gap-3 border-b border-outline-variant/60 py-4 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge tone={change.change_type === "new_item" || change.change_type === "new_bundle" ? "primary" : "secondary"}>
            {CHANGE_TYPE_LABEL[change.change_type]}
          </Badge>
          <p className="text-on-surface">{change.payload.name as string}</p>
        </div>
        <ul className="text-sm text-on-surface-variant">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {error && <p className="text-sm text-error">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <form action={dismissAction}>
          <Button type="submit" variant="outlined" disabled={busy}>
            Dismiss
          </Button>
        </form>
        <form action={applyAction}>
          <Button type="submit" variant="filled" disabled={busy}>
            Approve
          </Button>
        </form>
      </div>
    </li>
  );
}

export function PendingChangesList({ changes }: { changes: PendingChange[] }) {
  if (changes.length === 0) {
    return <p className="text-sm text-on-surface-variant">No changes waiting for review.</p>;
  }
  return <ul>{changes.map((change) => <PendingChangeRow key={change.id} change={change} />)}</ul>;
}

export function SyncNowButton() {
  const [state, action, pending] = useActionState(
    async () => runSyncNow(),
    { error: null } as { error: string | null },
  );

  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="tonal" disabled={pending}>
        {pending ? "Syncing…" : "Run sync now"}
      </Button>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
    </form>
  );
}
