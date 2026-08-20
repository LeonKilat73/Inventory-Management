"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/requirePermission";
import { parseItemFormData, parseBundleFormData } from "@/lib/validation/item";
import { recordStockMovement } from "@/lib/stock/ledger";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export async function createItem(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("items", "create");

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

  const { data: newItem, error } = await supabase
    .from("items")
    .insert({
      sku,
      name: v.name,
      description: v.description || null,
      category_id: v.categoryId || null,
      unit_cost: v.unitCost ?? null,
      unit_price: v.unitPrice ?? null,
      reorder_threshold: v.reorderThreshold,
      reorder_quantity: v.reorderQuantity ?? null,
      allow_backorder: v.allowBackorder,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // An item has no quantity column of its own -- stock is always derived
  // from stock_movements (see ledger.ts), so seeding "how many do I have"
  // means posting one opening movement, same mechanism QuickAdjustStockForm
  // uses once the item already exists. Best-effort: the item itself is
  // already created and committed by this point, so a failure here surfaces
  // as its own message rather than rolling back the whole item.
  if (v.initialQuantity && v.initialQuantity > 0) {
    try {
      await recordStockMovement(supabase, {
        itemId: newItem.id,
        movementType: "manual_adjustment",
        direction: "increase",
        quantity: v.initialQuantity,
        note: "Initial stock on hand",
        createdBy: user.id,
      });
    } catch (err) {
      return {
        error: `Item was created, but recording its starting quantity failed: ${err instanceof Error ? err.message : "unknown error"}. Use "Adjust" on the item's page to add it manually.`,
      };
    }
  }

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
      allow_backorder: v.allowBackorder,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/items");
  return ok;
}

// True hard delete -- only actually succeeds for an item with no history.
// item_id is referenced (without cascade) by stock_movements (append-only,
// no delete path of its own), purchase_order_lines, bundle_items, and
// defective_items, so Postgres blocks the delete (23503) the moment an item
// has ever been received, sold, adjusted, or put in a bundle. Surfaced as a
// plain "deactivate instead" message rather than the raw FK error, same
// pattern as deleteUserAccount in actions/users.ts.
export async function deleteItem(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("items", "delete");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing item id." };

  const supabase = await createClient();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "This item can't be deleted because it has activity on record (stock movements, purchase orders, bundles, etc.) that other data still depends on. Deactivate it instead to hide it from the catalog while keeping that history intact.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  return ok;
}

// Deactivate/reactivate -- the everyday way to retire an item (test items,
// discontinued products) without losing its stock history. Already honored
// elsewhere (dashboard low-stock query, external GET /api/v1/items both
// filter on is_active) -- this is what actually drives that flag from the
// Items screen itself.
export async function setItemActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("items", "edit");

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return { error: "Missing item id." };

  const supabase = await createClient();
  const { error } = await supabase.from("items").update({ is_active: active }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/items");
  revalidatePath("/items/bundles");
  return ok;
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

// Renames/reprices a bundle and replaces its constituent list wholesale
// (the form always submits the full intended set, so a diff isn't worth
// the complexity). Uses the admin client for the bundle_items swap: doing
// it through the normal client would need the caller to hold both
// bundles.create and bundles.delete (bundle_items' own RLS policies), not
// just bundles.edit -- three permissions for what's conceptually one
// action. requirePermission below is still the real gate.
export async function updateBundle(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("bundles", "edit");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing bundle id." };

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

  const admin = createAdminClient();

  const { error: itemError } = await admin
    .from("items")
    .update({ sku: v.sku, name: v.name, category_id: v.categoryId || null, unit_price: v.bundlePrice })
    .eq("id", id);
  if (itemError) return { error: itemError.message };

  const { error: bundleError } = await admin.from("bundles").update({ bundle_price: v.bundlePrice }).eq("id", id);
  if (bundleError) return { error: bundleError.message };

  const { error: deleteError } = await admin.from("bundle_items").delete().eq("bundle_id", id);
  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await admin
    .from("bundle_items")
    .insert(v.itemIds.map((itemId, i) => ({ bundle_id: id, item_id: itemId, quantity: v.quantities[i] })));
  if (insertError) return { error: insertError.message };

  revalidatePath("/items/bundles");
  return ok;
}

// Same shape as deleteItem -- bundles -> items cascade delete removes the
// bundle_items rows too, but the bundle's own item_id can still be blocked
// by purchase_order_lines/stock_movements/defective_items if it was ever
// sold or adjusted directly.
export async function deleteBundle(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("bundles", "delete");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing bundle id." };

  const supabase = await createClient();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "This bundle can't be deleted because it has activity on record (sales, stock movements, etc.). Deactivate it instead to hide it from the catalog while keeping that history intact.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/items/bundles");
  return ok;
}

// Deactivate/reactivate for a bundle -- same is_active flag and same
// downstream effect (dashboard, external API) as setItemActive above.
export async function setBundleActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("bundles", "edit");

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return { error: "Missing bundle id." };

  const supabase = await createClient();
  const { error } = await supabase.from("items").update({ is_active: active }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/items/bundles");
  return ok;
}
