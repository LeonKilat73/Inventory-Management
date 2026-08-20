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

export type ManualMovementType = "sale" | "replacement_out" | "replacement_in" | "manual_adjustment";

export type RecordMovementInput = {
  itemId: string;
  movementType: ManualMovementType;
  direction?: "increase" | "decrease";
  quantity: number;
  note?: string | null;
  createdBy: string | null;
};

// Shared by the internal server action (src/actions/stockMovements.ts, gated
// by requirePermission) and the external API route (src/app/api/v1/stock-movements,
// gated by an API key) so the over-sell guard can't drift between the two
// entry points. Callers are responsible for authorization -- this only
// enforces the data invariant (never go negative).
export async function recordStockMovement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: RecordMovementInput,
) {
  const isDecrease =
    input.movementType === "sale" ||
    input.movementType === "replacement_out" ||
    (input.movementType === "manual_adjustment" && input.direction === "decrease");

  if (input.movementType === "manual_adjustment" && !input.direction) {
    throw new Error("Pick whether this adjustment increases or decreases stock.");
  }

  const quantityDelta = isDecrease ? -input.quantity : input.quantity;

  if (isDecrease) {
    const currentStock = await getCurrentStock(supabase, input.itemId);
    if (currentStock + quantityDelta < 0) {
      const { data: item } = await supabase
        .from("items")
        .select("allow_backorder")
        .eq("id", input.itemId)
        .single();
      if (!item?.allow_backorder) {
        throw new Error(`Only ${currentStock} in stock -- can't remove ${input.quantity}.`);
      }
    }
  }

  const { error } = await supabase.from("stock_movements").insert({
    item_id: input.itemId,
    quantity_delta: quantityDelta,
    movement_type: input.movementType,
    note: input.note || null,
    created_by: input.createdBy,
  });

  if (error) throw new Error(error.message);
}
