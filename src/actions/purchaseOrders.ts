"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { parsePurchaseOrderFormData, receiveLineSchema } from "@/lib/validation/purchaseOrder";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export async function createPurchaseOrder(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("purchase_orders", "create");

  const parsed = parsePurchaseOrderFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  if (v.itemIds.length !== v.quantities.length || v.itemIds.length !== v.unitCosts.length) {
    return { error: "Each line item needs a quantity and unit cost." };
  }
  if (new Set(v.itemIds).size !== v.itemIds.length) {
    return { error: "Each item can only appear once per purchase order." };
  }

  const supabase = await createClient();

  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .insert({
      po_number: v.poNumber,
      supplier_id: v.supplierId,
      status: "draft",
      ordered_at: new Date().toISOString().slice(0, 10),
      expected_at: v.expectedAt || null,
      notes: v.notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (poError || !po) {
    return { error: poError?.message ?? "Could not create purchase order." };
  }

  const { error: linesError } = await supabase.from("purchase_order_lines").insert(
    v.itemIds.map((itemId, i) => ({
      purchase_order_id: po.id,
      item_id: itemId,
      quantity_ordered: v.quantities[i],
      unit_cost: v.unitCosts[i],
    })),
  );

  if (linesError) return { error: linesError.message };

  revalidatePath("/purchase-orders");
  return ok;
}

export async function submitPurchaseOrder(id: string) {
  await requirePermission("purchase_orders", "edit");

  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "submitted" })
    .eq("id", id)
    .eq("status", "draft");

  if (error) throw new Error(error.message);

  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
}

export async function receivePurchaseOrderLine(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("purchase_orders", "receive");

  const parsed = receiveLineSchema.safeParse({
    lineId: formData.get("lineId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const poId = String(formData.get("poId") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase_order_line", {
    p_line_id: parsed.data.lineId,
    p_quantity: parsed.data.quantity,
  });

  if (error) return { error: error.message };

  if (poId) revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
  revalidatePath("/items");
  return ok;
}
