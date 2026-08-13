import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Current stock is always derived from the stock_movements ledger (see
// item_stock_levels view in supabase/migrations) -- items has no quantity
// column. This is the one place app code reads it, so callers don't
// duplicate the "0 if no rows" fallback.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCurrentStock(supabase: SupabaseClient<any>, itemId: string) {
  const { data, error } = await supabase
    .from("item_stock_levels")
    .select("current_stock")
    .eq("item_id", itemId)
    .single();

  if (error) throw new Error(error.message);
  return data.current_stock as number;
}
