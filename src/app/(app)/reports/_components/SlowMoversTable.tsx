"use client";

import { useState } from "react";

const PAGE_SIZE = 15;

// Labels are formatted on the server and passed in as strings so the
// server render and the browser's hydration can never disagree on locale or
// timezone output.
export type SlowMoverRow = {
  id: string;
  sku: string;
  name: string;
  categoryLabel: string;
  stock: number;
  stockCostLabel: string;
  lastSoldLabel: string;
};

export function SlowMoversTable({ rows }: { rows: SlowMoverRow[] }) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-on-surface-variant">
            <tr>
              <th className="pb-2 pr-4 font-medium">Item</th>
              <th className="pb-2 pr-4 font-medium">Category</th>
              <th className="pb-2 pr-4 text-right font-medium">On hand</th>
              <th className="pb-2 pr-4 text-right font-medium">Stock cost</th>
              <th className="pb-2 font-medium">Last sold</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className="border-t border-outline-variant/60">
                <td className="py-2 pr-4">
                  <p className="text-on-surface">{row.name}</p>
                  <p className="font-mono text-xs text-on-surface-variant">{row.sku}</p>
                </td>
                <td className="py-2 pr-4 text-on-surface-variant">{row.categoryLabel}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-on-surface">{row.stock}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-on-surface">{row.stockCostLabel}</td>
                <td className="whitespace-nowrap py-2 text-on-surface-variant">{row.lastSoldLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-on-surface-variant">
          Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} of{" "}
          {rows.length.toLocaleString("en-PH")} items
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="rounded-md border border-outline px-3 py-1.5 text-sm text-on-surface hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40"
            >
              Previous
            </button>
            <select
              value={safePage}
              onChange={(e) => setPage(Number(e.target.value))}
              aria-label="Page"
              className="rounded-md border border-outline bg-surface px-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Page {n} of {totalPages}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="rounded-md border border-outline px-3 py-1.5 text-sm text-on-surface hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
