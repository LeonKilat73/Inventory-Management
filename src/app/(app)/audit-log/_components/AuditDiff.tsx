"use client";

import { useState } from "react";

type JsonRecord = Record<string, unknown>;

function formatValue(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function AuditDiff({
  action,
  oldData,
  newData,
}: {
  action: string;
  oldData: JsonRecord | null;
  newData: JsonRecord | null;
}) {
  const [open, setOpen] = useState(false);

  if (!oldData && !newData) return null;

  const keys = Array.from(new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])).sort();
  // updated_at changes on every update alongside whatever actually changed
  // (or, previously, on its own for a no-op save -- now skipped at the
  // trigger level, but older rows can still have it) -- it's never itself
  // the meaningful part of a diff, so it's excluded from the comparison.
  const changedKeys =
    action === "update"
      ? keys.filter((k) => k !== "updated_at" && JSON.stringify(oldData?.[k]) !== JSON.stringify(newData?.[k]))
      : keys;

  if (action === "update" && changedKeys.length === 0) {
    // Pre-fix rows from before the audit trigger started skipping true
    // no-op updates -- nothing meaningful to show, so don't invite a click.
    return <span className="text-sm text-on-surface-variant">No meaningful changes</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-primary underline underline-offset-2"
      >
        {open ? "Hide details" : "View details"}
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-outline-variant/60">
          <table className="w-full text-xs">
            <thead className="bg-surface-container-high text-left text-on-surface-variant">
              <tr>
                <th className="px-3 py-1.5 font-medium">Field</th>
                {action !== "insert" && <th className="px-3 py-1.5 font-medium">Before</th>}
                {action !== "delete" && <th className="px-3 py-1.5 font-medium">After</th>}
              </tr>
            </thead>
            <tbody>
              {changedKeys.map((key) => (
                <tr key={key} className="border-t border-outline-variant/60">
                  <td className="px-3 py-1.5 font-mono text-on-surface-variant">{key}</td>
                  {action !== "insert" && (
                    <td className="px-3 py-1.5 text-on-surface">{formatValue(oldData?.[key])}</td>
                  )}
                  {action !== "delete" && (
                    <td className="px-3 py-1.5 text-on-surface">{formatValue(newData?.[key])}</td>
                  )}
                </tr>
              ))}
              {changedKeys.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-on-surface-variant">
                    No field changes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
