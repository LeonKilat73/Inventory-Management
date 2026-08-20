# Changelog

## 2026-08-20

### New: Made-to-order items ("allow backorder")
- Items can now be marked to allow selling past zero stock (for made-to-order goods like custom decals) — a sale still gets logged in the ledger like any other purchase instead of being rejected. Displayed stock never goes negative regardless (floors at 0 everywhere it's shown — Items, Dashboard, reorder suggestions, POS's catalog), and reorder threshold still works exactly as before as the signal to restock/produce more. New checkbox on the item form; a "Backorder" badge shows next to the stock number when it's on. This also fixes the guard in `fn_record_pos_sale` (the function POS's checkout calls to log a sale) so a made-to-order line, or a bundle whose constituent is made-to-order, isn't rejected the way a real oversell still correctly is. Verified live: confirmed the guard still blocks a normal item at 0 stock, allows a flagged item and a flagged bundle constituent through (both plain-line and bundle-override code paths), and ran one real POS checkout end-to-end for a made-to-order test item before voiding it and cleaning up.

### New: Edit bundles
- Bundles could previously only be created, deactivated, or (hard) deleted — no way to fix a name, price, category, or its list of constituent items without recreating it. Added an Edit option next to each bundle that opens the same form pre-filled, including add/remove on individual constituent rows. Verified live: renamed the existing "SET 2" bundle to "Alpine Set 2" (its constituents and price carried over untouched) — also fixes the QuickBooks bundle-matching gap noted below, since the name now matches QuickBooks' own "Alpine Set 2" Group.

### New: QuickBooks catalog sync (Phase 2)
- `/admin/quickbooks` now keeps the item catalog in sync with QuickBooks: a daily automatic check (plus a manual "Run sync now" button) links existing items/categories to their QuickBooks counterparts by name, and surfaces genuinely new or changed items in a review queue — nothing is written to the catalog without an admin approving it first. QuickBooks' own item categories map directly onto this app's category tree, and QuickBooks' "Group" items (its own bundle concept) map onto this app's bundles. Verified against the real connected company: 68 categories and 599 items linked automatically, 127 genuine new/changed items left for review, two applied and one dismissed as a live test (a new office item and a real stock/price update went through correctly; the dismissal will resurface on the next sync since the underlying QuickBooks data is still different).
- Note for review: a handful of existing bundles (the ones named just "SET 1", "SET 2", etc.) don't share a name with their QuickBooks counterpart ("Alpine Set 1", "JBL Set 2", ...), so those showed up as *new* bundle proposals rather than being auto-linked — approving them as-is would create duplicates. Worth renaming the existing bundles to match QuickBooks (or dismissing those specific proposals) before touching that part of the queue.

### New: QuickBooks Online connection (Phase 1)
- Added an `/admin/quickbooks` page to connect this app to the shop's real QuickBooks Online company via OAuth — the groundwork for keeping the item catalog in sync and eventually backfilling historical sales into POS's Analytics. This phase is connection-only: no data syncs yet. Tokens are stored admin-only, never exposed to the browser or logged in the audit trail.

## 2026-08-19

### Fixed
- "Forgot password?" failed with a PKCE "code verifier not found" error whenever the reset link was opened on a different browser or device than the one that requested it (the normal case). Same root cause and fix as POS's equivalent bug from the night before, just not caught here yet since this app's reset flow predates that session.
- Connected Resend as a real email provider (Supabase → Authentication → SMTP Settings), replacing the default sender's low rate limit that was causing password-reset emails to silently fail. Verified live: multiple resets in quick succession now go through cleanly instead of hitting "email rate limit exceeded." Note: Resend is still in sandbox mode (no verified domain yet), so real delivery is currently limited to the account's own registered address — resetting other staff accounts won't actually land in their inbox until a domain is added.

### New: Bundle sale customization (for POS)
- The sales API now accepts an actual-parts-used list for a bundle line, instead of always applying the bundle's fixed recipe — lets POS's checkout support skipping or swapping individual bundle parts per sale. Also fixes a related bug: returning/refunding a bundle sale that had a part skipped would have failed outright (tried to restock something that was never taken), since returns always re-derived from the recipe too.

### New: QuickBooks catalog import
- Imported 441 new items from a QuickBooks Product/Service export, sorted into existing or new categories following the same SKU-prefix pattern the catalog already uses, with opening stock recorded from QuickBooks' on-hand quantities. 386 of those have no price yet (QuickBooks never had one) and are flagged for follow-up. 58 rows that were already in the catalog under a different name were matched and skipped rather than duplicated. QuickBooks entries that were really internal fees/labor/subscriptions, not products, or genuine service line items, were deliberately left out — reviewed with you before import, not auto-decided.

## 2026-08-18

### Display & UX
- Item descriptions in the Items list are now click-to-expand instead of always showing full text.
- Currency switched from $ to ₱ (Philippine pesos) throughout.
- Items list is now paginated (25 per page) in its own scrollable box with Previous/Next and a page dropdown.
- Sidebar user info card moved from the bottom to the top, right-aligned on the same row as the sidebar title.
- Dashboard and sidebar are now mobile-friendly (collapsible hamburger menu on phones).
- Renamed "Audit Log" to "Logs" in the page heading and sidebar nav.

### Security
- Added idle-timeout auto sign-out: 5 minutes of inactivity triggers a warning, then signs out after a 60-second grace period. Session cookie is now session-only (closing the browser signs you out).
- Set up Dependabot for weekly, grouped dependency-update PRs.

### Fixed
- Logins and password resets were showing up as "System" in the Logs page instead of the actual staff member's name, because that write path couldn't identify who it was. Now correctly attributed to the real user.

### New: Reports & reorder suggestions
- Added a Reports page: best-sellers and slow-movers, computed from actual recorded sales, with a week/month/quarter/year/all-time selector. Shows units sold and estimated revenue per item.
- Added a Reorder Suggestions page: every item at or below its reorder threshold, grouped by whichever supplier it was last ordered from, with suggested quantities and costs pre-filled — review and click to create a draft purchase order instead of rebuilding it by hand. Linked from the Dashboard's low-stock card and the Purchase Orders page.

### New: CSV export
- Added "Export CSV" on the Items page (full catalog, not just the current page of results), Stock Movements page (the full ledger, not just the 100 most recent), and the Reports page (matches whichever period is selected). Opens cleanly in Excel, including the ₱ symbol.

### New: Mobile support for Items, Purchase Orders, and Suppliers
- These three pages now show a proper stacked card list on phones instead of a cramped scrolling table — same data and actions, just comfortable to use on a phone. Their forms (add/edit item, add/edit supplier, new purchase order, reorder suggestions) now stack cleanly on narrow screens instead of squeezing fields side by side.

### New: Supplier performance tracking
- Each supplier's page now shows orders placed, average lead time, on-time delivery rate, and a recent price-paid-per-item history so a creeping price on a repeat order actually gets noticed instead of blending into the PO list.

### New: Barcode scanner support
- Works with any USB or Bluetooth barcode scanner set up as a keyboard (no camera, no app pairing) — scan a SKU into the new field on a purchase order to receive one unit per scan, into the Stock Movements form to select the item, or into the Items search box to look it up.
