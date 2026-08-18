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
