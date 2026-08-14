"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { recordStockMovement as recordStockMovementInLedger } from "@/lib/stock/ledger";
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

  const supabase = await createClient();

  try {
    await recordStockMovementInLedger(supabase, {
      itemId: v.itemId,
      movementType: v.movementType,
      direction: v.direction,
      quantity: v.quantity,
      note: v.note,
      createdBy: user.id,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not record movement." };
  }

  revalidatePath("/stock/movements");
  revalidatePath("/items");
  revalidatePath("/items/bundles");
  // Covers every /items/[itemId] page, not just one -- this action is also
  // called from the item edit page's quick-adjust form, and it doesn't know
  // ahead of time which item's detail page (if any) needs a refresh.
  revalidatePath("/items/[itemId]", "page");
  return ok;
}
