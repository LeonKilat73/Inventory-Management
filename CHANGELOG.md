# Changelog

## 2026-10-08

### New: Bulk price update, and a "needs attention" filter on Items
- About 405 active items have no price, and neither does QuickBooks, so the prices have to come from the shop's own list. 350 of them have stock on the shelf, and once POS is the main sales channel they would sell at ₱0. Editing them one by one isn't realistic, so Items now has **Bulk price update**: download the list of items without a price (or the full list), fill in the Unit Price (and optionally Unit Cost) column in Excel, save as CSV, and import it. The file is read and checked first and shows exactly what will change (old price to new price), which SKUs weren't found, and which rows have problems; nothing is saved until you press Apply. Prices written like "₱1,250.50" are understood, bundles are skipped (their price is edited on the Bundles page), and the whole import is one all-or-nothing step. Each change is still audited under your name, but instead of hundreds of "Item updated" alerts every admin gets one summary notification.
- The Items list has a new **needs attention** menu: No price, Price below cost, No category, each with a count.
- POS shows a red "No price set" warning on any cart line priced at zero.

### Security and stability pass (whole app)
- **Critical, already fixed in the database:** several server-only database functions (recording, voiding and returning POS sales, and the three login-lockout functions) could be called by anyone on the internet without logging in, using only the public key that ships in the website's code, and the public stock view listed every item's id. Together that allowed fabricating or voiding sales, moving stock, and locking out or unlocking accounts. They are now restricted to the server; the POS sales API, logins, and signed-in use were re-tested and still work.
- **Stock ledger hardened:** a direct write to the stock ledger needed only the permission, so any staff member could insert any movement type, any sign (e.g. +999 labelled "po_receipt"), and no author. The database now only accepts the four manual movement types from users, requires the sign to match the type, and always records the signed-in user as the author. Receiving, defect handling, POS sales, voids and returns were regression-tested (22 checks).
- **Open redirect fixed:** after login (and after a password-reset link) the app followed whatever address was in the link, so a crafted link could send someone to a look-alike site right after signing in. It now only goes to pages inside the app.
- **CSV exports** no longer run formulas: an item or supplier named like `=HYPERLINK(...)` is exported as plain text.
- **Login and password-reset lookups** now reject identifiers containing characters that could alter the database filter.
- QuickBooks connect/callback returned a raw 500 to people without permission; they now return a proper 401/403.
- **Next.js upgraded 16.3.0 → 16.3.8** (it had a batch of security advisories); `npm audit` now reports 0 vulnerabilities. Production build and a 12-page smoke test pass.
- **Notification and audit noise:** every bulk QuickBooks link or import raised an "Item updated" notification per item for every admin (about 670 unread in one admin's bell) and an audit entry. Bookkeeping-only updates no longer notify or audit (QuickBooks id links are still audited, and real edits still notify); the existing 1,291 were marked read, not deleted. Added indexes on seven frequently-joined foreign keys.
- Verified with throwaway accounts: a plain staff user was blocked from reading API keys, the audit log, other users, QuickBooks tokens and expenses, and from changing prices, roles or approvals; all 22 pages load without errors and none overflow at phone width.

### New: Purchase order approval
- Every new purchase order is now sent to one named approver, picked from the people who hold the approve permission (managers and admins by default; you can't pick yourself). They get a notification in the app and an email with a link; the link goes through sign-in and lands on the order, where they choose **Approve** or **Reject** (rejecting needs a reason). The order shows an approval label (Not approved yet / Approved / Rejected), who it was sent to, and when; the Purchase Orders list gets an Approval column with the approver's email. "Not approved" is only a label and doesn't block anything.
- The rules live in the database, not just the screen: only the person it was sent to can decide, the creator can never approve their own order, and nobody can flip the approval with an ordinary edit. The approver's email is stored on the order and the audit log records who decided and when. Approved orders are harder to delete: the PO number has to be typed to confirm (still blocked once goods are received).
- Email caveat: the sender is still Resend's shared test address, so emails to real colleagues won't deliver until a domain is verified (planned for next week). Until then the approver is still notified in the app, the order shows the email hasn't gone out, and a "Resend approval email" button sends it once email works. Orders created before this have no approver and show "No approval".

### New: Cancel and Delete on purchase orders
- A purchase order's page now has **Cancel order** (for submitted or partly received orders: nothing more can be received, anything already received stays in stock and on record) and **Delete order**, each with an inline "are you sure" step. Delete only works while nothing has been received against the order; it then removes the order, its lines and the delivery reminder it put on the calendar. Once goods have been received the order stays on record, because stock movements and expenses depend on it, and the page says so and points to Cancel. The rule is enforced in the database (`fn_delete_purchase_order`), not just hidden in the UI.

### Fixed: deleting a supplier with purchase orders crashed with a server error
- Clicking Delete on a supplier that any purchase order points at (every supplier that has ever been ordered from) threw the raw database error and showed a generic server error page. It now explains why it can't be deleted and suggests deactivating instead, same as items and bundles. Suppliers also got Deactivate / Reactivate on the list (inactive suppliers drop out of the purchase-order, reorder and calendar supplier pickers but stay on existing orders). A supplier with no orders still deletes cleanly.

### Changed: Slow movers report is readable now
- The Reports page's "Slow movers" section used to print every active item with no sales as an identical pill, which on the real catalog meant a wall of ~670 names. It now only lists items that actually have units on the shelf (an item with zero stock and zero sales isn't slow, it just isn't stocked), headed by a summary of how many items, units and how much stock cost is sitting unsold. They are shown in a table (category, on hand, stock cost, last sold date) sorted by stock cost, 15 per page with Previous / Next and a page dropdown, the same way the Items list pages. A short note explains that only sales recorded in this system count, since sales rung up directly in QuickBooks aren't included. The CSV export is unchanged.

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
