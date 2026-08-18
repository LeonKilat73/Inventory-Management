# Changelog

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
