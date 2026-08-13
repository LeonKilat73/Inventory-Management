"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { getCurrentStock } from "@/lib/stock/ledger";
import { parseStockMovementFormData } from "@/lib/validation/stockMovement";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export async function recordStockMovement(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("stock_movements", "create");

  const parsed = parseStockMovementFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const isDecrease =
    v.movementType === "sale" ||
    v.movementType === "replacement_out" ||
    (v.movementType === "manual_adjustment" && v.direction === "decrease");

  if (v.movementType === "manual_adjustment" && !v.direction) {
    return { error: "Pick whether this adjustment increases or decreases stock." };
  }

  const quantityDelta = isDecrease ? -v.quantity : v.quantity;

  const supabase = await createClient();

  if (isDecrease) {
    const currentStock = await getCurrentStock(supabase, v.itemId);
    if (currentStock + quantityDelta < 0) {
      return {
        error: `Only ${currentStock} in stock -- can't remove ${v.quantity}.`,
      };
    }
  }

  const { error } = await supabase.from("stock_movements").insert({
    item_id: v.itemId,
    quantity_delta: quantityDelta,
    movement_type: v.movementType,
    note: v.note || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/stock/movements");
  revalidatePath("/items");
  revalidatePath("/items/bundles");
  return ok;
}
