"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteOrigin } from "@/lib/getSiteOrigin";
import { sendPurchaseOrderApprovalEmail } from "@/lib/email/purchaseOrderApproval";
import { requirePermission } from "@/lib/auth/requirePermission";
import { parsePurchaseOrderFormData, receiveLineSchema } from "@/lib/validation/purchaseOrder";

export type ActionState = { error: string | null; poId?: string; notice?: string };
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
      approver_id: v.approverId,
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

  const notice = await emailApprovalRequest(po.id);

  revalidatePath("/purchase-orders");
  return { error: null, poId: po.id, notice };
}

// Emails the order's approver and records when it went out. The approver is
// also notified in-app by a database trigger, so a failed email (for example
// while the sender domain isn't verified yet) never leaves them unaware.
// Returns a sentence for the creator to read.
async function emailApprovalRequest(poId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: po } = await admin
    .from("purchase_orders")
    .select("po_number, approver_email, created_by, suppliers(name)")
    .eq("id", poId)
    .single();
  if (!po?.approver_email) return "";

  const { data: requester } = po.created_by
    ? await admin.from("profiles").select("full_name, email").eq("id", po.created_by).single()
    : { data: null };
  const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
  const origin = await getSiteOrigin();

  const result = await sendPurchaseOrderApprovalEmail({
    to: po.approver_email,
    poNumber: po.po_number,
    supplierName: supplier?.name ?? null,
    requesterName: requester?.full_name || requester?.email || "A teammate",
    link: `${origin}/purchase-orders/${poId}`,
  });

  if (result.sent) {
    await admin.from("purchase_orders").update({ approval_email_sent_at: new Date().toISOString() }).eq("id", poId);
    return `Approval request emailed to ${po.approver_email}.`;
  }
  return `${po.approver_email} has been notified in the app, but the email couldn't be sent yet (${result.reason}). Use "Resend approval email" on the order once email is set up.`;
}

export async function resendApprovalEmail(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("purchase_orders", "edit");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing purchase order id." };

  const admin = createAdminClient();
  const { data: po } = await admin.from("purchase_orders").select("approval_status").eq("id", id).single();
  if (po?.approval_status !== "pending") return { error: "This order isn't waiting for approval." };

  const notice = await emailApprovalRequest(id);
  revalidatePath(`/purchase-orders/${id}`);
  return { error: null, notice };
}

// Approve or reject. The rules (only the person it was sent to, never the
// creator, rejection needs a reason) live in fn_decide_po_approval, which
// runs as the signed-in user so the audit log records who decided.
export async function decidePurchaseOrderApproval(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("purchase_orders", "approve");

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id) return { error: "Missing purchase order id." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_decide_po_approval", {
    p_po_id: id,
    p_decision: decision,
    p_note: String(formData.get("note") ?? "") || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/purchase-orders/${id}`);
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

// Closes an order that's still open without losing its history: whatever was
// already received stays received (stock and expenses are untouched), but no
// more can be received against it -- receive_purchase_order_line only accepts
// submitted/partially_received orders.
export async function cancelPurchaseOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("purchase_orders", "edit");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing purchase order id." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["draft", "submitted", "partially_received"])
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "This order can no longer be cancelled." };

  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
  return ok;
}

// The checks (nothing received, no expenses, no defect reports) and the
// deletes live in fn_delete_purchase_order so they're atomic; its own
// messages are what the user sees when a delete is refused.
export async function deletePurchaseOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("purchase_orders", "delete");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing purchase order id." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_delete_purchase_order", {
    p_po_id: id,
    p_confirm: String(formData.get("confirm") ?? "") || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/purchase-orders");
  revalidatePath("/calendar");
  redirect("/purchase-orders");
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
