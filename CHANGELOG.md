# Changelog

## 2026-08-19

### Fixed
- "Forgot password?" failed with a PKCE "code verifier not found" error whenever the reset link was opened on a different browser or device than the one that requested it (the normal case). Same root cause and fix as POS's equivalent bug from the night before, just not caught here yet since this app's reset flow predates that session.
- Connected Resend as a real email provider (Supabase → Authentication → SMTP Settings), replacing the default sender's low rate limit that was causing password-reset emails to silently fail. Verified live: multiple resets in quick succession now go through cleanly instead of hitting "email rate limit exceeded." Note: Resend is still in sandbox mode (no verified domain yet), so real delivery is currently limited to the account's own registered address — resetting other staff accounts won't actually land in their inbox until a domain is added.

### New: Bundle sale customization (for POS)
- The sales API now accepts an actual-parts-used list for a bundle line, instead of always applying the bundle's fixed recipe — lets POS's checkout support skipping or swapping individual bundle parts per sale. Also fixes a related bug: returning/refunding a bundle sale that had a part skipped would have failed outright (tried to restock something that was never taken), since returns always re-derived from the recipe too.

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
