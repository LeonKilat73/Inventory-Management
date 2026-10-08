"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";

export type PriceImportResult = {
  applied: boolean;
  rows: number;
  willChange: number;
  updated: number;
  unchanged: number;
  notFound: string[];
  notFoundCount: number;
  invalid: { row: number; sku: string | null; reason: string }[];
  invalidCount: number;
  bundles: string[];
  bundlesCount: number;
  sample: { sku: string; name: string; oldPrice: number | null; newPrice: number | null; oldCost: number | null; newCost: number | null }[];
};

export type PriceImportState = { error: string | null; result?: PriceImportResult };

// apply = false only reports what would change; apply = true writes it. The
// rules (permission, validation, one summary notification instead of one per
// item) live in fn_bulk_update_item_prices so the import is atomic and the
// same check runs whichever way it is called.
export async function importItemPrices(
  rows: { sku: string; price?: string; cost?: string }[],
  apply: boolean,
): Promise<PriceImportState> {
  await requirePermission("items", "edit");

  if (!Array.isArray(rows) || rows.length === 0) return { error: "There are no rows to import." };
  if (rows.length > 5000) return { error: "That file has more than 5000 rows. Split it into smaller files." };

  const clean = rows.map((r) => ({
    sku: String(r?.sku ?? "").slice(0, 64),
    price: r?.price === undefined ? undefined : String(r.price).slice(0, 32),
    cost: r?.cost === undefined ? undefined : String(r.cost).slice(0, 32),
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_bulk_update_item_prices", { p_rows: clean, p_apply: apply });
  if (error) return { error: error.message };

  if (apply) {
    revalidatePath("/items");
    revalidatePath("/reports");
  }
  return { error: null, result: data as PriceImportResult };
}
