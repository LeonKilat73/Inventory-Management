"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/requirePermission";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStock, recordStockMovement } from "@/lib/stock/ledger";
import { runCatalogSync, skuForQuickbooksItem, type SyncResult } from "@/lib/quickbooks/sync";

type AdminClient = ReturnType<typeof createAdminClient>;

export type PendingChange = {
  id: string;
  quickbooks_item_id: string;
  change_type: "new_item" | "updated_item" | "new_bundle" | "deactivated";
  item_id: string | null;
  payload: Record<string, unknown>;
  detected_at: string;
};

export async function runSyncNow(): Promise<{ error: string | null; result?: SyncResult }> {
  await requirePermission("quickbooks", "edit");
  try {
    const result = await runCatalogSync();
    revalidatePath("/admin/quickbooks");
    return { error: null, result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed." };
  }
}

export async function getPendingChanges(): Promise<PendingChange[]> {
  await requirePermission("quickbooks", "view");
  const admin = createAdminClient();
  const { data } = await admin
    .from("quickbooks_pending_changes")
    .select("id, quickbooks_item_id, change_type, item_id, payload, detected_at")
    .is("resolved_at", null)
    .order("detected_at", { ascending: true });
  return (data ?? []) as PendingChange[];
}

export async function dismissPendingChange(id: string): Promise<{ error: string | null }> {
  const user = await requirePermission("quickbooks", "edit");
  const admin = createAdminClient();

  const { error, count } = await admin
    .from("quickbooks_pending_changes")
    .update({ resolved_at: new Date().toISOString(), resolved_by: user.id, resolution: "dismissed" }, { count: "exact" })
    .eq("id", id)
    .is("resolved_at", null);

  if (error) return { error: error.message };
  if (count === 0) return { error: "This change was already resolved." };

  revalidatePath("/admin/quickbooks");
  return { error: null };
}

// QuickBooks only knows a category when the item has a parent there that is
// already mapped; otherwise categoryId arrives as null. On an UPDATE that
// must mean "no opinion", not "clear it" -- writing null here silently wiped
// the category of items that had one locally (they ended up uncategorized).
function categoryIfKnown(categoryId: string | null): { category_id?: string } {
  return categoryId ? { category_id: categoryId } : {};
}

async function applyNewItem(admin: AdminClient, change: PendingChange, userId: string) {
  const p = change.payload as {
    name: string;
    description: string | null;
    categoryId: string | null;
    unitPrice: number | null;
    unitCost: number | null;
    reorderThreshold: number;
    isActive: boolean;
    tracksQty: boolean;
    qtyOnHand: number | null;
  };

  const { data: item, error } = await admin
    .from("items")
    .insert({
      sku: skuForQuickbooksItem(change.quickbooks_item_id),
      name: p.name,
      description: p.description,
      category_id: p.categoryId,
      unit_cost: p.unitCost,
      unit_price: p.unitPrice,
      reorder_threshold: p.reorderThreshold,
      is_active: p.isActive,
      quickbooks_id: change.quickbooks_item_id,
      quickbooks_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (p.tracksQty && p.qtyOnHand && p.qtyOnHand > 0) {
    await recordStockMovement(admin, {
      itemId: item.id,
      movementType: "manual_adjustment",
      direction: "increase",
      quantity: p.qtyOnHand,
      note: "Initial stock from QuickBooks catalog sync.",
      createdBy: userId,
    });
  }
}

async function applyUpdatedItem(admin: AdminClient, change: PendingChange, userId: string) {
  if (!change.item_id) throw new Error("This change has no linked item to update.");

  const p = change.payload as {
    name: string;
    description: string | null;
    categoryId: string | null;
    unitPrice: number | null;
    unitCost: number | null;
    reorderThreshold: number;
    isActive: boolean;
    tracksQty: boolean;
    qtyOnHand: number | null;
    diff?: Record<string, { from: unknown; to: unknown }>;
    isBundle?: boolean;
    bundlePrice?: number;
    constituents?: Array<{ itemId: string; quantity: number }>;
  };

  if (p.isBundle) {
    await admin
      .from("items")
      .update({
        name: p.name,
        ...categoryIfKnown(p.categoryId),
        unit_price: p.bundlePrice,
        quickbooks_synced_at: new Date().toISOString(),
      })
      .eq("id", change.item_id);
    await admin.from("bundles").update({ bundle_price: p.bundlePrice }).eq("id", change.item_id);
    await admin.from("bundle_items").delete().eq("bundle_id", change.item_id);
    if (p.constituents?.length) {
      const { error } = await admin
        .from("bundle_items")
        .insert(p.constituents.map((c) => ({ bundle_id: change.item_id, item_id: c.itemId, quantity: c.quantity })));
      if (error) throw new Error(error.message);
    }
    return;
  }

  // Only the fields the reviewer was actually shown (the diff) are written --
  // not a wholesale overwrite with QuickBooks values, which used to clear
  // categories and blank out prices QuickBooks never had. A blank/zero
  // QuickBooks price or cost never replaces a real one here either.
  const diff = p.diff ?? {};
  const { data: current } = await admin.from("items").select("unit_price, unit_cost").eq("id", change.item_id).single();
  const blankOverReal = (qb: number | null, local: number | null | undefined) => Number(qb ?? 0) === 0 && Number(local ?? 0) > 0;

  const patch: Record<string, unknown> = { quickbooks_synced_at: new Date().toISOString() };
  if (diff.name) patch.name = p.name;
  if (diff.unitPrice && !blankOverReal(p.unitPrice, current?.unit_price)) patch.unit_price = p.unitPrice;
  if (diff.unitCost && !blankOverReal(p.unitCost, current?.unit_cost)) patch.unit_cost = p.unitCost;
  if (diff.reorderThreshold) patch.reorder_threshold = p.reorderThreshold;
  if (diff.isActive) patch.is_active = p.isActive;
  await admin.from("items").update(patch).eq("id", change.item_id);

  if (diff.stock && p.tracksQty && p.qtyOnHand !== null) {
    const currentStock = await getCurrentStock(admin, change.item_id);
    // Older queued rows can still carry a negative QuickBooks count.
    const delta = Math.max(0, p.qtyOnHand) - currentStock;
    if (delta !== 0) {
      await recordStockMovement(admin, {
        itemId: change.item_id,
        movementType: "manual_adjustment",
        direction: delta > 0 ? "increase" : "decrease",
        quantity: Math.abs(delta),
        note: "Stock adjustment from QuickBooks catalog sync.",
        createdBy: userId,
      });
    }
  }
}

async function applyNewBundle(admin: AdminClient, change: PendingChange) {
  const p = change.payload as {
    name: string;
    categoryId: string | null;
    bundlePrice: number;
    constituents: Array<{ itemId: string; quantity: number }>;
  };

  const { data: item, error } = await admin
    .from("items")
    .insert({
      sku: skuForQuickbooksItem(change.quickbooks_item_id),
      name: p.name,
      category_id: p.categoryId,
      unit_price: p.bundlePrice,
      is_bundle: true,
      quickbooks_id: change.quickbooks_item_id,
      quickbooks_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: bundleError } = await admin.from("bundles").insert({ id: item.id, bundle_price: p.bundlePrice });
  if (bundleError) throw new Error(bundleError.message);

  if (p.constituents.length) {
    const { error: itemsError } = await admin
      .from("bundle_items")
      .insert(p.constituents.map((c) => ({ bundle_id: item.id, item_id: c.itemId, quantity: c.quantity })));
    if (itemsError) throw new Error(itemsError.message);
  }
}

// Shared by the single Approve button and Approve all so both go through exactly
// the same write path. Returns an error message, or null once applied and resolved.
async function applyChange(admin: AdminClient, change: PendingChange, userId: string): Promise<string | null> {
  try {
    if (change.change_type === "new_item") {
      await applyNewItem(admin, change, userId);
    } else if (change.change_type === "new_bundle") {
      await applyNewBundle(admin, change);
    } else {
      await applyUpdatedItem(admin, change, userId);
    }
  } catch (err) {
    return err instanceof Error ? err.message : "Failed to apply this change.";
  }

  await admin
    .from("quickbooks_pending_changes")
    .update({ resolved_at: new Date().toISOString(), resolved_by: userId, resolution: "applied" })
    .eq("id", change.id);
  return null;
}

export async function applyPendingChange(id: string): Promise<{ error: string | null }> {
  const user = await requirePermission("quickbooks", "edit");
  const admin = createAdminClient();

  const { data: change } = await admin
    .from("quickbooks_pending_changes")
    .select("id, quickbooks_item_id, change_type, item_id, payload, detected_at")
    .eq("id", id)
    .is("resolved_at", null)
    .maybeSingle();
  if (!change) return { error: "This change was already resolved." };

  const error = await applyChange(admin, change as PendingChange, user.id);
  if (error) return { error };

  revalidatePath("/admin/quickbooks");
  return { error: null };
}

export type ApplyAllResult = {
  error: string | null;
  applied: number;
  failed: { name: string; error: string }[];
  remaining: number;
};

// The page allows 60s (maxDuration); stop a little short of it so a long queue
// is finished by pressing the button again rather than being cut off mid-write.
const APPLY_ALL_BUDGET_MS = 45_000;

export async function applyAllPendingChanges(): Promise<ApplyAllResult> {
  const user = await requirePermission("quickbooks", "edit");
  const admin = createAdminClient();

  const { data } = await admin
    .from("quickbooks_pending_changes")
    .select("id, quickbooks_item_id, change_type, item_id, payload, detected_at")
    .is("resolved_at", null)
    .order("detected_at", { ascending: true });
  const changes = (data ?? []) as PendingChange[];

  const started = Date.now();
  const failed: ApplyAllResult["failed"] = [];
  let applied = 0;
  let remaining = 0;

  for (const [index, change] of changes.entries()) {
    if (Date.now() - started > APPLY_ALL_BUDGET_MS) {
      remaining = changes.length - index;
      break;
    }
    const error = await applyChange(admin, change, user.id);
    if (error) failed.push({ name: String(change.payload.name ?? change.quickbooks_item_id), error });
    else applied++;
  }

  revalidatePath("/admin/quickbooks");
  return { error: null, applied, failed, remaining };
}
