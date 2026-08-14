"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { parseExpenseFormData } from "@/lib/validation/expense";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export async function createExpense(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("expenses", "create");

  const parsed = parseExpenseFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    source: "manual",
    amount: v.amount,
    category: v.category || null,
    description: v.description || null,
    incurred_at: v.incurredAt,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return ok;
}
