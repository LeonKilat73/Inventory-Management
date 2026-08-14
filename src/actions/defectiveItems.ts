"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { parseReportDefectiveFormData, resolveDefectiveSchema } from "@/lib/validation/defectiveItem";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export async function reportDefectiveItem(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("defective_items", "create");

  const parsed = parseReportDefectiveFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("report_defective_item", {
    p_item_id: v.itemId,
    p_quantity: v.quantity,
    p_reason: v.reason || null,
    p_related_po_id: v.relatedPoId || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/stock/defective");
  revalidatePath("/items");
  return ok;
}

export async function resolveDefectiveItem(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("defective_items", "edit");

  const parsed = resolveDefectiveSchema.safeParse({
    defectiveId: formData.get("defectiveId"),
    resolution: formData.get("resolution"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_defective_item", {
    p_defective_id: parsed.data.defectiveId,
    p_resolution: parsed.data.resolution,
  });

  if (error) return { error: error.message };

  revalidatePath("/stock/defective");
  revalidatePath("/items");
  return ok;
}
