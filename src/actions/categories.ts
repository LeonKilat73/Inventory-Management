"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  parentId: z.string().uuid().optional().or(z.literal("")),
  skuPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,10}$/, "Prefix must be 1-10 letters/numbers, no spaces")
    .optional()
    .or(z.literal("")),
  skuNextNumber: z.coerce.number().int().positive().default(1),
});

function parseCategoryFormData(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    parentId: formData.get("parentId") ?? "",
    skuPrefix: formData.get("skuPrefix") ?? "",
    skuNextNumber: formData.get("skuNextNumber") || 1,
  });
}

export async function createCategory(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("items", "create");

  const parsed = parseCategoryFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    name: v.name,
    parent_id: v.parentId || null,
    sku_prefix: v.skuPrefix || null,
    sku_next_number: v.skuNextNumber,
  });

  if (error) return { error: error.message };
  revalidatePath("/items/categories");
  revalidatePath("/items");
  return ok;
}

export async function updateCategory(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("items", "edit");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing category id." };

  const parsed = parseCategoryFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  if (v.parentId === id) {
    return { error: "A category can't be its own parent." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name: v.name,
      parent_id: v.parentId || null,
      sku_prefix: v.skuPrefix || null,
      sku_next_number: v.skuNextNumber,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/items/categories");
  revalidatePath("/items");
  return ok;
}

// Read-only -- doesn't consume a number, just shows what the next one would
// be. Composes the parent's prefix in for a brand sub-category, matching
// what fn_next_sku actually generates at save time (see items.ts createItem).
export async function previewNextSku(categoryId: string): Promise<string | null> {
  await requirePermission("items", "view");
  if (!categoryId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("sku_prefix, sku_next_number, parent:parent_id(sku_prefix)")
    .eq("id", categoryId)
    .single();

  if (!data?.sku_prefix) return null;

  const parent = Array.isArray(data.parent) ? data.parent[0] : data.parent;
  const number = String(data.sku_next_number).padStart(4, "0");
  return parent?.sku_prefix ? `${parent.sku_prefix}-${data.sku_prefix}-${number}` : `${data.sku_prefix}-${number}`;
}
