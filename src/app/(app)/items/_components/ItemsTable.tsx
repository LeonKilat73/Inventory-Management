"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteItem } from "@/actions/items";
import { Badge } from "@/components/ui/Badge";

export type ItemRow = {
  id: string;
  sku: string;
  name: string;
  categoryName: string | null;
  stock: number;
  reorderThreshold: number;
  unitCost: number | null;
  unitPrice: number | null;
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !q || item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
      const matchesCategory = !category || item.categoryName === category;
      return matchesQuery && matchesCategory;
    });
  }, [items, query, category]);

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
            placeholder="Search by SKU or name…"
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
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
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
            {filtered.map((item) => {
              const lowStock = item.stock <= item.reorderThreshold;
              return (
                <tr
                  key={item.id}
                  className="border-t border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low"
                >
                  <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{item.categoryName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{item.stock}</span>
                      {lowStock && <Badge tone="error">Reorder</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{item.unitCost != null ? `$${item.unitCost}` : "—"}</td>
                  <td className="px-4 py-3">{item.unitPrice != null ? `$${item.unitPrice}` : "—"}</td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-4">
                        {canEdit && (
                          <Link
                            href={`/items/${item.id}`}
                            className="text-primary underline underline-offset-2"
                          >
                            Edit
                          </Link>
                        )}
                        {canDelete && (
                          <form action={deleteItem.bind(null, item.id)}>
                            <button type="submit" className="text-error underline underline-offset-2">
                              Delete
                            </button>
                          </form>
                        )}
                      </div>
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

      {items.length > 0 && (
        <p className="text-xs text-on-surface-variant">
          Showing {filtered.length} of {items.length} items
        </p>
      )}
    </div>
  );
}
