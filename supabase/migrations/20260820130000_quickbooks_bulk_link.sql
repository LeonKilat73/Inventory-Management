-- The catalog sync's first full run needs to silently link several hundred
-- existing items/categories to their QuickBooks counterparts by name match
-- (see src/lib/quickbooks/sync.ts). Doing that one UPDATE per row from a
-- Vercel serverless function timed out (FUNCTION_INVOCATION_TIMEOUT) against
-- 733 QuickBooks items -- each round trip to the Tokyo-region database adds
-- real latency. These two functions let the sync flush all pure identity
-- links (no data change, just recording which QuickBooks record an existing
-- row corresponds to) in one round trip instead of hundreds.

create function fn_bulk_link_quickbooks_items(p_item_ids uuid[], p_quickbooks_ids text[])
returns void
language sql
set search_path = public
as $$
  update items
  set quickbooks_id = v.qbid, quickbooks_synced_at = now()
  from unnest(p_item_ids, p_quickbooks_ids) as v(id, qbid)
  where items.id = v.id;
$$;

create function fn_bulk_link_quickbooks_categories(p_category_ids uuid[], p_quickbooks_ids text[])
returns void
language sql
set search_path = public
as $$
  update categories
  set quickbooks_id = v.qbid
  from unnest(p_category_ids, p_quickbooks_ids) as v(id, qbid)
  where categories.id = v.id;
$$;

-- No permission check inside (unlike fn_next_sku) and no grant to
-- `authenticated` -- these are only ever called from the service-role admin
-- client in code that has already called requirePermission('quickbooks', ...)
-- itself, same posture as every other quickbook_connections/pending_changes
-- write in this feature.
