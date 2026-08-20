import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { quickbooksFetch, QuickbooksNotConnectedError } from "./client";

type AdminClient = ReturnType<typeof createAdminClient>;

// Shape of a QuickBooks Item, trimmed to the fields this sync actually
// reads. Confirmed against the real connected company (733 items): Type is
// one of Category (grouping node, no price/stock), Inventory/NonInventory
// (real products), Service (labor, not inventory), or Group (QuickBooks'
// own bundle concept -- ItemGroupDetail.ItemGroupLine[] lists constituents).
// No Sku field exists anywhere in QuickBooks' data.
type QuickbooksItem = {
  Id: string;
  Name: string;
  Description?: string;
  Type: "Category" | "Inventory" | "NonInventory" | "Service" | "Group";
  Active: boolean;
  UnitPrice?: number;
  PurchaseCost?: number;
  TrackQtyOnHand?: boolean;
  QtyOnHand?: number;
  ReorderPoint?: number;
  ParentRef?: { value: string };
  Level?: number;
  ItemGroupDetail?: { ItemGroupLine?: Array<{ ItemRef: { value: string }; Qty: number }> };
};

type ItemDiff = Record<string, { from: unknown; to: unknown }>;

export type SyncResult = {
  categoriesLinked: number;
  categoriesCreated: number;
  itemsLinked: number;
  pendingCreated: number;
  pendingUpdated: number;
  bundlesSkipped: number;
  errors: string[];
};

const PAGE_SIZE = 1000;

async function fetchAllItems(sinceIso: string | null): Promise<QuickbooksItem[]> {
  const items: QuickbooksItem[] = [];
  let startPosition = 1;
  for (;;) {
    const whereClause = sinceIso ? ` where Metadata.LastUpdatedTime > '${sinceIso}'` : "";
    const query = `select * from Item${whereClause} startposition ${startPosition} maxresults ${PAGE_SIZE}`;
    const json = (await quickbooksFetch(`query?query=${encodeURIComponent(query)}`)) as {
      QueryResponse?: { Item?: QuickbooksItem[] };
    };
    const page = json.QueryResponse?.Item ?? [];
    items.push(...page);
    if (page.length < PAGE_SIZE) break;
    startPosition += PAGE_SIZE;
  }
  return items;
}

// null and 0 are treated as equivalent -- "no cost/price recorded" and
// "recorded as exactly zero" aren't a meaningful business difference, and
// without this the review queue fills up with hundreds of items whose only
// "change" is that QuickBooks reports an explicit 0 where Inventory just
// never had a cost entered (confirmed against the real catalog: 455 of the
// first run's 499 flagged items were exactly this, drowning out the ~44
// that were genuine price/stock differences).
function numDiffers(a: number | null, b: number | null): boolean {
  return Math.abs((a ?? 0) - (b ?? 0)) > 0.001;
}

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

// Generated deterministically from the QuickBooks item id (unique within
// the company) rather than via fn_next_sku -- that function checks
// fn_has_permission(auth.uid(), ...), which only resolves correctly under a
// real user session, not the service-role client this sync runs under. An
// admin can rename the SKU afterward from the normal item edit form.
function skuForQuickbooksItem(quickbooksId: string): string {
  return `QB-${quickbooksId}`;
}

// ---------------------------------------------------------------------------
// Sync context: every table this sync consults, loaded in a handful of
// batch queries up front instead of one query per QuickBooks item. The
// first run touches ~700 items -- at one round trip per lookup that's
// thousands of sequential queries to a database a region away, which is
// exactly what timed out the first attempt (FUNCTION_INVOCATION_TIMEOUT).
// Everything below reads/writes this in-memory context and only the pure
// identity links (no data change) get deferred into a single bulk RPC call
// at the end; genuine new/changed items still get their own
// quickbooks_pending_changes row, but there are far fewer of those.
// ---------------------------------------------------------------------------

type LocalItemFields = {
  id: string;
  name: string;
  unit_price: number | null;
  unit_cost: number | null;
  reorder_threshold: number;
  is_active: boolean;
};

type SyncContext = {
  categoryByQbId: Map<string, { id: string; name: string }>;
  categoryByNameKey: Map<string, { id: string }>; // key: `${parentId ?? "root"}::${name}`
  itemByQbId: Map<string, LocalItemFields>;
  itemByNameKey: Map<string, LocalItemFields>;
  bundleByQbId: Map<string, { id: string; unit_price: number | null }>;
  bundleByNameKey: Map<string, { id: string }>;
  bundleConstituents: Map<string, Array<{ item_id: string; quantity: number }>>;
  stockByItemId: Map<string, number>;
  openPendingByQbId: Map<string, string>;
  categoryLinkOps: Array<{ id: string; quickbooksId: string }>;
  itemLinkOps: Array<{ id: string; quickbooksId: string }>;
  pendingInsertOps: Array<{ quickbooks_item_id: string; change_type: string; item_id: string | null; payload: unknown }>;
  pendingUpdateOps: Array<{ id: string; change_type: string; item_id: string | null; payload: unknown }>;
};

async function loadSyncContext(admin: AdminClient): Promise<SyncContext> {
  const [
    { data: catLinked },
    { data: catUnlinked },
    { data: itemsLinked },
    { data: itemsUnlinked },
    { data: bundlesLinked },
    { data: bundlesUnlinked },
    { data: bundleItemRows },
    { data: stockRows },
    { data: pendingRows },
  ] = await Promise.all([
    admin.from("categories").select("id, name, quickbooks_id").not("quickbooks_id", "is", null),
    admin.from("categories").select("id, name, parent_id").is("quickbooks_id", null),
    admin
      .from("items")
      .select("id, name, unit_price, unit_cost, reorder_threshold, is_active, quickbooks_id")
      .eq("is_bundle", false)
      .not("quickbooks_id", "is", null),
    admin
      .from("items")
      .select("id, name, unit_price, unit_cost, reorder_threshold, is_active")
      .eq("is_bundle", false)
      .is("quickbooks_id", null),
    admin.from("items").select("id, unit_price, quickbooks_id").eq("is_bundle", true).not("quickbooks_id", "is", null),
    admin.from("items").select("id, name").eq("is_bundle", true).is("quickbooks_id", null),
    admin.from("bundle_items").select("bundle_id, item_id, quantity"),
    admin.from("item_stock_levels").select("item_id, current_stock"),
    admin.from("quickbooks_pending_changes").select("id, quickbooks_item_id").is("resolved_at", null),
  ]);

  const categoryByQbId = new Map((catLinked ?? []).map((c) => [c.quickbooks_id as string, { id: c.id, name: c.name }]));
  const categoryByNameKey = new Map(
    (catUnlinked ?? []).map((c) => [`${c.parent_id ?? "root"}::${nameKey(c.name)}`, { id: c.id }]),
  );
  const itemByQbId = new Map((itemsLinked ?? []).map((i) => [i.quickbooks_id as string, i as LocalItemFields]));
  const itemByNameKey = new Map((itemsUnlinked ?? []).map((i) => [nameKey(i.name), i as LocalItemFields]));
  const bundleByQbId = new Map((bundlesLinked ?? []).map((b) => [b.quickbooks_id as string, { id: b.id, unit_price: b.unit_price }]));
  const bundleByNameKey = new Map((bundlesUnlinked ?? []).map((b) => [nameKey(b.name), { id: b.id }]));
  const bundleConstituents = new Map<string, Array<{ item_id: string; quantity: number }>>();
  for (const row of bundleItemRows ?? []) {
    const list = bundleConstituents.get(row.bundle_id) ?? [];
    list.push({ item_id: row.item_id, quantity: row.quantity });
    bundleConstituents.set(row.bundle_id, list);
  }
  const stockByItemId = new Map((stockRows ?? []).map((s) => [s.item_id as string, s.current_stock as number]));
  const openPendingByQbId = new Map((pendingRows ?? []).map((p) => [p.quickbooks_item_id as string, p.id as string]));

  return {
    categoryByQbId,
    categoryByNameKey,
    itemByQbId,
    itemByNameKey,
    bundleByQbId,
    bundleByNameKey,
    bundleConstituents,
    stockByItemId,
    openPendingByQbId,
    categoryLinkOps: [],
    itemLinkOps: [],
    pendingInsertOps: [],
    pendingUpdateOps: [],
  };
}

// Every deferred write from the whole run happens here, in a handful of
// round trips instead of one per item. Bulk RPCs for pure identity links
// (see the migration for why a plain multi-row UPDATE won't do it through
// PostgREST), one multi-row insert for brand-new pending changes (by far
// the common case, since no pending change exists yet the first time a
// given QuickBooks item is seen), and individual updates only for the rare
// case of a pending change that already existed from an earlier run.
async function flushBatchedWrites(admin: AdminClient, ctx: SyncContext) {
  if (ctx.categoryLinkOps.length > 0) {
    const { error } = await admin.rpc("fn_bulk_link_quickbooks_categories", {
      p_category_ids: ctx.categoryLinkOps.map((o) => o.id),
      p_quickbooks_ids: ctx.categoryLinkOps.map((o) => o.quickbooksId),
    });
    if (error) throw new Error(`Bulk category link failed: ${error.message}`);
  }
  if (ctx.itemLinkOps.length > 0) {
    const { error } = await admin.rpc("fn_bulk_link_quickbooks_items", {
      p_item_ids: ctx.itemLinkOps.map((o) => o.id),
      p_quickbooks_ids: ctx.itemLinkOps.map((o) => o.quickbooksId),
    });
    if (error) throw new Error(`Bulk item link failed: ${error.message}`);
  }
  if (ctx.pendingInsertOps.length > 0) {
    const { error } = await admin.from("quickbooks_pending_changes").insert(ctx.pendingInsertOps);
    if (error) throw new Error(`Recording pending changes failed: ${error.message}`);
  }
  for (const op of ctx.pendingUpdateOps) {
    await admin
      .from("quickbooks_pending_changes")
      .update({ change_type: op.change_type, item_id: op.item_id, payload: op.payload, detected_at: new Date().toISOString() })
      .eq("id", op.id);
  }
}

function upsertPendingChange(
  ctx: SyncContext,
  args: { quickbooksItemId: string; changeType: string; itemId: string | null; payload: unknown },
) {
  const existingId = ctx.openPendingByQbId.get(args.quickbooksItemId);
  if (existingId) {
    ctx.pendingUpdateOps.push({ id: existingId, change_type: args.changeType, item_id: args.itemId, payload: args.payload });
    return;
  }
  ctx.pendingInsertOps.push({
    quickbooks_item_id: args.quickbooksItemId,
    change_type: args.changeType,
    item_id: args.itemId,
    payload: args.payload,
  });
}

// Categories mirror QuickBooks' own Level/ParentRef structure onto
// Inventory's existing root/brand-child model directly -- low-stakes,
// auto-applied, no review queue (same posture as the ~40 categories the
// earlier manual CSV import created without individual sign-off).
async function syncCategory(admin: AdminClient, cat: QuickbooksItem, ctx: SyncContext, result: SyncResult) {
  let parentLocalId: string | null = null;
  if (cat.ParentRef?.value) {
    const parent = ctx.categoryByQbId.get(cat.ParentRef.value);
    if (!parent) {
      result.errors.push(`Category "${cat.Name}": parent category not yet synced, skipped.`);
      return;
    }
    parentLocalId = parent.id;
  }

  const existing = ctx.categoryByQbId.get(cat.Id);
  if (existing) {
    if (existing.name !== cat.Name) {
      await admin.from("categories").update({ name: cat.Name }).eq("id", existing.id);
      ctx.categoryByQbId.set(cat.Id, { id: existing.id, name: cat.Name });
    }
    result.categoriesLinked++;
    return;
  }

  const nameMatch = ctx.categoryByNameKey.get(`${parentLocalId ?? "root"}::${nameKey(cat.Name)}`);
  if (nameMatch) {
    ctx.categoryLinkOps.push({ id: nameMatch.id, quickbooksId: cat.Id });
    ctx.categoryByQbId.set(cat.Id, { id: nameMatch.id, name: cat.Name });
    result.categoriesLinked++;
    return;
  }

  const { data, error } = await admin
    .from("categories")
    .insert({ name: cat.Name, parent_id: parentLocalId, quickbooks_id: cat.Id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  ctx.categoryByQbId.set(cat.Id, { id: data.id, name: cat.Name });
  result.categoriesCreated++;
}

function computeItemDiff(local: LocalItemFields, currentStock: number | null, qb: QuickbooksItem): ItemDiff {
  const diff: ItemDiff = {};
  if (local.name !== qb.Name) diff.name = { from: local.name, to: qb.Name };

  const qbPrice = qb.UnitPrice ?? null;
  if (numDiffers(local.unit_price, qbPrice)) diff.unitPrice = { from: local.unit_price, to: qbPrice };

  const qbCost = qb.PurchaseCost ?? null;
  if (numDiffers(local.unit_cost, qbCost)) diff.unitCost = { from: local.unit_cost, to: qbCost };

  const qbReorder = qb.ReorderPoint ?? 0;
  if (local.reorder_threshold !== qbReorder) diff.reorderThreshold = { from: local.reorder_threshold, to: qbReorder };

  if (local.is_active !== qb.Active) diff.isActive = { from: local.is_active, to: qb.Active };

  if (qb.TrackQtyOnHand && currentStock !== null) {
    const qbQty = qb.QtyOnHand ?? 0;
    if (currentStock !== qbQty) diff.stock = { from: currentStock, to: qbQty };
  }

  return diff;
}

function onlyDeactivated(diff: ItemDiff): boolean {
  const keys = Object.keys(diff);
  return keys.length === 1 && keys[0] === "isActive" && diff.isActive.to === false;
}

function buildItemPayload(qi: QuickbooksItem, categoryId: string | null, diff: ItemDiff) {
  return {
    name: qi.Name,
    description: qi.Description ?? null,
    categoryId,
    unitPrice: qi.UnitPrice ?? null,
    unitCost: qi.PurchaseCost ?? null,
    reorderThreshold: qi.ReorderPoint ?? 0,
    isActive: qi.Active,
    tracksQty: !!qi.TrackQtyOnHand,
    qtyOnHand: qi.TrackQtyOnHand ? qi.QtyOnHand ?? 0 : null,
    diff,
  };
}

function resolveCategoryId(ctx: SyncContext, qi: QuickbooksItem): string | null {
  if (!qi.ParentRef?.value) return null;
  return ctx.categoryByQbId.get(qi.ParentRef.value)?.id ?? null;
}

async function syncPlainItem(admin: AdminClient, qi: QuickbooksItem, ctx: SyncContext, result: SyncResult) {
  const categoryId = resolveCategoryId(ctx, qi);

  const linked = ctx.itemByQbId.get(qi.Id);
  if (linked) {
    const currentStock = qi.TrackQtyOnHand ? ctx.stockByItemId.get(linked.id) ?? 0 : null;
    const diff = computeItemDiff(linked, currentStock, qi);
    if (Object.keys(diff).length === 0) {
      result.itemsLinked++;
      return;
    }
    upsertPendingChange(ctx, {
      quickbooksItemId: qi.Id,
      changeType: onlyDeactivated(diff) ? "deactivated" : "updated_item",
      itemId: linked.id,
      payload: buildItemPayload(qi, categoryId, diff),
    });
    result.pendingUpdated++;
    return;
  }

  const nameMatch = ctx.itemByNameKey.get(nameKey(qi.Name));
  if (nameMatch) {
    ctx.itemLinkOps.push({ id: nameMatch.id, quickbooksId: qi.Id });
    ctx.itemByQbId.set(qi.Id, nameMatch);
    ctx.itemByNameKey.delete(nameKey(qi.Name));

    const currentStock = qi.TrackQtyOnHand ? ctx.stockByItemId.get(nameMatch.id) ?? 0 : null;
    const diff = computeItemDiff(nameMatch, currentStock, qi);
    delete diff.name; // matched on name already -- not a meaningful difference

    if (Object.keys(diff).length > 0) {
      upsertPendingChange(ctx, {
        quickbooksItemId: qi.Id,
        changeType: onlyDeactivated(diff) ? "deactivated" : "updated_item",
        itemId: nameMatch.id,
        payload: buildItemPayload(qi, categoryId, diff),
      });
      result.pendingUpdated++;
    } else {
      result.itemsLinked++;
    }
    return;
  }

  upsertPendingChange(ctx, {
    quickbooksItemId: qi.Id,
    changeType: "new_item",
    itemId: null,
    payload: buildItemPayload(qi, categoryId, {}),
  });
  result.pendingCreated++;
}

type BundlePayload = {
  name: string;
  categoryId: string | null;
  bundlePrice: number;
  constituents: Array<{ itemId: string; quantity: number; name: string }>;
};

function bundleDiffers(
  linked: { unit_price: number | null },
  existingConstituents: Array<{ item_id: string; quantity: number }>,
  payload: BundlePayload,
): boolean {
  if (numDiffers(linked.unit_price, payload.bundlePrice)) return true;
  if (existingConstituents.length !== payload.constituents.length) return true;
  const existingMap = new Map(existingConstituents.map((c) => [c.item_id, c.quantity]));
  return payload.constituents.some((c) => existingMap.get(c.itemId) !== c.quantity);
}

// QuickBooks' Group item type is a direct structural match for Inventory's
// bundles/bundle_items tables. Only synced once every constituent is
// already linked (has a quickbooks_id) -- a Group referencing an
// unlinked/not-yet-approved constituent is skipped and retried on a later
// run once that constituent gets approved. Constituent links made earlier
// in this same run (via itemLinkOps, not yet flushed to the DB) still
// count, since ctx.itemByQbId is updated in-memory as soon as the link
// decision is made.
async function syncGroupItem(admin: AdminClient, g: QuickbooksItem, ctx: SyncContext, result: SyncResult) {
  const lines = g.ItemGroupDetail?.ItemGroupLine ?? [];
  const constituents: BundlePayload["constituents"] = [];

  for (const line of lines) {
    const item = ctx.itemByQbId.get(line.ItemRef.value);
    if (!item) {
      result.bundlesSkipped++;
      return;
    }
    constituents.push({ itemId: item.id, quantity: line.Qty ?? 1, name: item.name });
  }

  if (constituents.length === 0) {
    result.bundlesSkipped++;
    return;
  }

  const categoryId = resolveCategoryId(ctx, g);
  const payload: BundlePayload = { name: g.Name, categoryId, bundlePrice: g.UnitPrice ?? 0, constituents };

  const linked = ctx.bundleByQbId.get(g.Id);
  if (linked) {
    const existingConstituents = ctx.bundleConstituents.get(linked.id) ?? [];
    if (bundleDiffers(linked, existingConstituents, payload)) {
      upsertPendingChange(ctx, {
        quickbooksItemId: g.Id,
        changeType: "updated_item",
        itemId: linked.id,
        payload: { ...payload, isBundle: true },
      });
      result.pendingUpdated++;
    } else {
      result.itemsLinked++;
    }
    return;
  }

  const nameMatch = ctx.bundleByNameKey.get(nameKey(g.Name));
  if (nameMatch) {
    ctx.itemLinkOps.push({ id: nameMatch.id, quickbooksId: g.Id });
    result.itemsLinked++;
    return;
  }

  upsertPendingChange(ctx, { quickbooksItemId: g.Id, changeType: "new_bundle", itemId: null, payload });
  result.pendingCreated++;
}

// The one entry point, called by both the daily cron route and the
// admin's manual "Run sync now" button. Categories go first (items need
// them resolved), Groups go last (bundles need their constituents already
// linked). Service-type items are skipped entirely -- not inventory.
export async function runCatalogSync(): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("quickbook_connections")
    .select("id, last_item_sync_at")
    .order("connected_at", { ascending: false })
    .limit(1)
    .single();
  if (!connection) throw new QuickbooksNotConnectedError();

  const syncStartedAt = new Date().toISOString();
  const [qbItems, ctx] = await Promise.all([fetchAllItems(connection.last_item_sync_at), loadSyncContext(admin)]);

  const result: SyncResult = {
    categoriesLinked: 0,
    categoriesCreated: 0,
    itemsLinked: 0,
    pendingCreated: 0,
    pendingUpdated: 0,
    bundlesSkipped: 0,
    errors: [],
  };

  const categories = qbItems.filter((i) => i.Type === "Category").sort((a, b) => (a.Level ?? 0) - (b.Level ?? 0));
  for (const cat of categories) {
    try {
      await syncCategory(admin, cat, ctx, result);
    } catch (err) {
      result.errors.push(`Category "${cat.Name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const plainItems = qbItems.filter((i) => i.Type === "Inventory" || i.Type === "NonInventory");
  for (const qi of plainItems) {
    try {
      await syncPlainItem(admin, qi, ctx, result);
    } catch (err) {
      result.errors.push(`Item "${qi.Name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const groups = qbItems.filter((i) => i.Type === "Group");
  for (const g of groups) {
    try {
      await syncGroupItem(admin, g, ctx, result);
    } catch (err) {
      result.errors.push(`Bundle "${g.Name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await flushBatchedWrites(admin, ctx);
  await admin.from("quickbook_connections").update({ last_item_sync_at: syncStartedAt }).eq("id", connection.id);

  return result;
}

export { skuForQuickbooksItem };
