"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { parseSupplierFormData } from "@/lib/validation/supplier";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export async function createSupplier(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("suppliers", "create");

  const parsed = parseSupplierFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({
    name: v.name,
    contact_name: v.contactName || null,
    email: v.email || null,
    phone: v.phone || null,
    address: v.address || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/suppliers");
  return ok;
}

export async function updateSupplier(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("suppliers", "edit");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing supplier id." };

  const parsed = parseSupplierFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: v.name,
      contact_name: v.contactName || null,
      email: v.email || null,
      phone: v.phone || null,
      address: v.address || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/suppliers");
  return ok;
}

// True hard delete -- only succeeds for a supplier no purchase order has ever
// pointed at. purchase_orders.supplier_id has no cascade, so Postgres blocks
// it (23503) once any order exists, including received ones that stock and
// expenses depend on. Surfaced as a plain "deactivate instead" message
// rather than the raw FK error, same pattern as deleteItem.
export async function deleteSupplier(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("suppliers", "delete");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing supplier id." };

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "This supplier can't be deleted because it has purchase orders on record that stock and expenses depend on. Deactivate it instead to stop using it for new orders while keeping that history intact.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/suppliers");
  return ok;
}

// Deactivate/reactivate -- the everyday way to retire a supplier. Inactive
// suppliers drop out of every "pick a supplier" list (new purchase orders,
// reorder suggestions, calendar) but stay on existing orders.
export async function setSupplierActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("suppliers", "edit");

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return { error: "Missing supplier id." };

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update({ is_active: active }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/suppliers");
  revalidatePath("/purchase-orders");
  return ok;
}
