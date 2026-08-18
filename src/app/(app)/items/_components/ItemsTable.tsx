"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ItemRowActions } from "./ItemRowActions";

const PAGE_SIZE = 25;

export type ItemRow = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  stock: number;
  reorderThreshold: number;
  unitCost: number | null;
  unitPrice: number | null;
  isActive: boolean;
};

export function ItemsTable({
  items,
  categoryNames,
  canEdit,
  canDelete,
}: {
  items: ItemRow[];
  categoryNames: string[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !q ||
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.categoryName?.toLowerCase().includes(q) ?? false);
      const matchesCategory = !category || item.categoryName === category;
      const matchesActive = showInactive || item.isActive;
      return matchesQuery && matchesCategory && matchesActive;
    });
  }, [items, query, category, showInactive]);

  // A new search/filter should always start back at page 1 -- adjusted
  // during render (React's recommended pattern for this, not an effect)
  // rather than a useEffect, which would cause an extra cascading render.
  const filterKey = `${query}|${category}|${showInactive}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            strokeWidth="1.6"
            stroke="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m17 17-4-4" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by SKU, name, or category…"
            className="w-full rounded-md border border-outline bg-surface py-2.5 pl-9 pr-4 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-outline bg-surface px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All categories</option>
          {categoryNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show deactivated
        </label>
      </div>

      <div className="hidden max-h-[640px] overflow-y-auto rounded-2xl border border-outline-variant/60 md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Price</th>
              {(canEdit || canDelete) && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => {
              const lowStock = item.stock <= item.reorderThreshold;
              return (
                <tr
                  key={item.id}
                  className="border-t border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low"
                >
                  <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{item.name}</span>
                      {!item.isActive && <Badge tone="neutral">Deactivated</Badge>}
                    </div>
                    {item.description && (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                          className="mt-1 block text-xs text-on-surface-variant underline underline-offset-2"
                        >
                          {expanded === item.id ? "Hide details" : "Details"}
                        </button>
                        {expanded === item.id && (
                          <p className="mt-1 max-w-xs text-xs text-on-surface-variant">{item.description}</p>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{item.categoryName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{item.stock}</span>
                      {lowStock && <Badge tone="error">Reorder</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{item.unitCost != null ? `₱${item.unitCost}` : "—"}</td>
                  <td className="px-4 py-3">{item.unitPrice != null ? `₱${item.unitPrice}` : "—"}</td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3 text-right">
                      <ItemRowActions
                        itemId={item.id}
                        isActive={item.isActive}
                        canEdit={canEdit}
                        canDelete={canDelete}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-on-surface-variant">
                  {items.length ? "No items match your search." : "No items yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="max-h-[640px] space-y-3 overflow-y-auto md:hidden">
        {pageItems.map((item) => {
          const lowStock = item.stock <= item.reorderThreshold;
          return (
            <div key={item.id} className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-on-surface">{item.name}</p>
                  <p className="font-mono text-xs text-on-surface-variant">{item.sku}</p>
                </div>
                {!item.isActive && <Badge tone="neutral">Deactivated</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface-variant">
                {item.categoryName && <span>{item.categoryName}</span>}
                <span className="flex items-center gap-1.5">
                  Stock: {item.stock}
                  {lowStock && <Badge tone="error">Reorder</Badge>}
                </span>
                <span>Cost: {item.unitCost != null ? `₱${item.unitCost}` : "—"}</span>
                <span>Price: {item.unitPrice != null ? `₱${item.unitPrice}` : "—"}</span>
              </div>
              {item.description && (
                <>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                    className="mt-2 block text-xs text-on-surface-variant underline underline-offset-2"
                  >
                    {expanded === item.id ? "Hide details" : "Details"}
                  </button>
                  {expanded === item.id && (
                    <p className="mt-1 text-xs text-on-surface-variant">{item.description}</p>
                  )}
                </>
              )}
              {(canEdit || canDelete) && (
                <div className="mt-3">
                  <ItemRowActions itemId={item.id} isActive={item.isActive} canEdit={canEdit} canDelete={canDelete} />
                </div>
              )}
            </div>
          );
        })}
        {!filtered.length && (
          <p className="text-center text-sm text-on-surface-variant">
            {items.length ? "No items match your search." : "No items yet."}
          </p>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length} items
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="rounded-md border border-outline px-3 py-1.5 text-sm text-on-surface disabled:opacity-40 disabled:pointer-events-none hover:bg-surface-container-high"
              >
                Previous
              </button>
              <select
                value={safePage}
                onChange={(e) => setPage(Number(e.target.value))}
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
                className="rounded-md border border-outline px-3 py-1.5 text-sm text-on-surface disabled:opacity-40 disabled:pointer-events-none hover:bg-surface-container-high"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
