"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { parseItemFormData, parseBundleFormData } from "@/lib/validation/item";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export async function createItem(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("items", "create");

  const skuAuto = formData.get("skuAuto") === "true";
  const parsed = parseItemFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createClient();

  let sku = v.sku;
  if (skuAuto && v.categoryId) {
    const { data: generated, error: skuError } = await supabase.rpc("fn_next_sku", {
      p_category_id: v.categoryId,
    });
    if (skuError) return { error: skuError.message };
    if (generated) sku = generated;
  }

  const { error } = await supabase.from("items").insert({
    sku,
    name: v.name,
    description: v.description || null,
    category_id: v.categoryId || null,
    unit_cost: v.unitCost ?? null,
    unit_price: v.unitPrice ?? null,
    reorder_threshold: v.reorderThreshold,
    reorder_quantity: v.reorderQuantity ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/items");
  return ok;
}

export async function updateItem(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("items", "edit");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing item id." };

  const parsed = parseItemFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({
      sku: v.sku,
      name: v.name,
      description: v.description || null,
      category_id: v.categoryId || null,
      unit_cost: v.unitCost ?? null,
      unit_price: v.unitPrice ?? null,
      reorder_threshold: v.reorderThreshold,
      reorder_quantity: v.reorderQuantity ?? null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/items");
  return ok;
}

export async function deleteItem(id: string) {
  await requirePermission("items", "delete");

  const supabase = await createClient();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/items");
}

export async function createBundle(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("bundles", "create");

  const skuAuto = formData.get("skuAuto") === "true";
  const parsed = parseBundleFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  if (v.itemIds.length !== v.quantities.length) {
    return { error: "Each constituent item needs a quantity." };
  }
  if (new Set(v.itemIds).size !== v.itemIds.length) {
    return { error: "Each item can only appear once in a bundle." };
  }

  const supabase = await createClient();

  let sku = v.sku;
  if (skuAuto && v.categoryId) {
    const { data: generated, error: skuError } = await supabase.rpc("fn_next_sku", {
      p_category_id: v.categoryId,
    });
    if (skuError) return { error: skuError.message };
    if (generated) sku = generated;
  }

  const { data: bundleItemRow, error: itemError } = await supabase
    .from("items")
    .insert({ sku, name: v.name, category_id: v.categoryId || null, unit_price: v.bundlePrice, is_bundle: true })
    .select("id")
    .single();

  if (itemError || !bundleItemRow) {
    return { error: itemError?.message ?? "Could not create bundle." };
  }

  const { error: bundleError } = await supabase
    .from("bundles")
    .insert({ id: bundleItemRow.id, bundle_price: v.bundlePrice });

  if (bundleError) return { error: bundleError.message };

  const { error: constituentsError } = await supabase.from("bundle_items").insert(
    v.itemIds.map((itemId, i) => ({
      bundle_id: bundleItemRow.id,
      item_id: itemId,
      quantity: v.quantities[i],
    })),
  );

  if (constituentsError) return { error: constituentsError.message };

  revalidatePath("/items/bundles");
  return ok;
}

export async function deleteBundle(id: string) {
  await requirePermission("bundles", "delete");

  const supabase = await createClient();
  // bundles -> items cascade delete removes the bundle_items rows too.
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/items/bundles");
}
