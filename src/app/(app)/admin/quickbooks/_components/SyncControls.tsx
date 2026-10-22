"use client";

import { useActionState, useState, useTransition } from "react";
import {
  runSyncNow,
  applyPendingChange,
  applyAllPendingChanges,
  dismissPendingChange,
  type ApplyAllResult,
  type PendingChange,
} from "@/actions/quickbooksSync";
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

function ApproveAll({ changes, onDone }: { changes: PendingChange[]; onDone: (result: ApplyAllResult) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const newItems = changes.filter((c) => c.change_type === "new_item").length;
  const newBundles = changes.filter((c) => c.change_type === "new_bundle").length;
  const updates = changes.length - newItems - newBundles;
  const unpriced = changes.filter(
    (c) => c.change_type === "new_item" && !(typeof c.payload.unitPrice === "number" && c.payload.unitPrice > 0),
  ).length;

  function run() {
    startTransition(async () => {
      const result = await applyAllPendingChanges();
      setConfirming(false);
      onDone(result);
    });
  }

  if (!confirming) {
    return (
      <Button type="button" variant="tonal" onClick={() => setConfirming(true)}>
        Approve all ({changes.length})
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-outline-variant bg-surface-container p-4">
      <p className="text-sm text-on-surface">
        Approve all {changes.length} waiting changes? That adds {newItems} new item{newItems === 1 ? "" : "s"} and{" "}
        {newBundles} new bundle{newBundles === 1 ? "" : "s"}, and applies {updates} update{updates === 1 ? "" : "s"}.
        You can still approve or dismiss them one by one instead.
      </p>
      {unpriced > 0 && (
        <p className="text-sm text-on-surface-variant">
          {unpriced === 1
            ? "1 new item has no price in QuickBooks; it will be added at ₱0 until you set one."
            : `${unpriced} new items have no price in QuickBooks; they will be added at ₱0 until you set one.`}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outlined" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button type="button" variant="filled" disabled={pending} onClick={run}>
          {pending ? "Approving…" : "Yes, approve all"}
        </Button>
      </div>
    </div>
  );
}

function ApproveAllNotice({ result, onClose }: { result: ApplyAllResult; onClose: () => void }) {
  return (
    <div className="space-y-2 rounded-lg border border-outline-variant bg-surface-container p-4 text-sm">
      <p className="text-on-surface">
        Approved {result.applied} change{result.applied === 1 ? "" : "s"}.
        {result.failed.length > 0 && ` ${result.failed.length} could not be applied and are still waiting below.`}
        {result.remaining > 0 && ` ${result.remaining} more are still waiting -- press Approve all again to continue.`}
      </p>
      {result.failed.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-error">
          {result.failed.map((f, i) => (
            <li key={i}>
              {f.name}: {f.error}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onClose} className="text-on-surface-variant underline underline-offset-2">
        Dismiss this message
      </button>
    </div>
  );
}

export function PendingChangesList({ changes }: { changes: PendingChange[] }) {
  const [result, setResult] = useState<ApplyAllResult | null>(null);

  return (
    <div className="space-y-3">
      {changes.length > 0 && <ApproveAll changes={changes} onDone={setResult} />}
      {result && <ApproveAllNotice result={result} onClose={() => setResult(null)} />}
      {changes.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No changes waiting for review.</p>
      ) : (
        <ul>{changes.map((change) => <PendingChangeRow key={change.id} change={change} />)}</ul>
      )}
    </div>
  );
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
