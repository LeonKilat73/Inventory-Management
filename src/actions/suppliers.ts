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

export async function deleteSupplier(id: string) {
  await requirePermission("suppliers", "delete");

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/suppliers");
}
