# Inventory API (v1)

A small REST surface for external applications (e.g. a POS) to read the
catalog/stock and post stock movements, separate from the app's own Server
Actions. All endpoints live under `/api/v1` and require an API key.

## Authentication

Create a key at **Admin → API Keys** in the app (admin only). Send it as a
bearer token:

```
Authorization: Bearer invk_xxxxxxxxxxxxxxxxxxxxxxxx
```

Keys are either **read-only** or **read + write**. Read-only keys can call
`GET` endpoints; write endpoints (`POST`) require a read + write key.

Keys are shown once at creation and stored server-side only as a SHA-256
hash — if you lose one, revoke it and create a new one.

## Endpoints

### `GET /api/v1/items`

List all active items with their current stock.

```json
{
  "items": [
    {
      "id": "uuid",
      "sku": "DCAM-2000",
      "name": "1080p Dual-Channel Dash Cam",
      "description": "...",
      "category": "Dash Cams",
      "unitPrice": 69.99,
      "unitCost": 32,
      "isBundle": false,
      "stock": 3,
      "reorderThreshold": 8
    }
  ]
}
```

### `GET /api/v1/items/:id`

A single item, same shape as above (minus the `items` wrapper), plus `isActive`.

### `GET /api/v1/stock-movements?itemId=&limit=`

The stock ledger, newest first. `itemId` (optional) filters to one item.
`limit` (optional, default 50, max 200).

```json
{
  "movements": [
    {
      "id": "uuid",
      "item_id": "uuid",
      "quantity_delta": -1,
      "movement_type": "sale",
      "note": "...",
      "created_at": "2026-08-14T12:00:00Z"
    }
  ]
}
```

### `POST /api/v1/stock-movements`

Record a movement (requires a read + write key). Same rules as the in-app
manual entry: `sale`/`replacement_out` decrease stock, `replacement_in`
increases it, `manual_adjustment` needs an explicit `direction`. Stock can
never go negative — the request is rejected if it would.

Request body:

```json
{
  "itemId": "uuid",
  "movementType": "sale",
  "quantity": 1,
  "note": "Order #4821"
}
```

For `manual_adjustment`, also include `"direction": "increase" | "decrease"`.

Responses: `201 { "ok": true }` on success, `400 { "error": "..." }` on
validation failure or insufficient stock, `401`/`403` for auth problems.

## Webhooks

`POST /api/v1/webhooks/notifications-dispatch` sends an email for a
notification, called by a **Supabase Database Webhook** (not by external
apps) whenever a row is inserted into `notifications`.

**This isn't wired up yet.** Supabase's cloud infrastructure needs a public
URL to call, and while this app only runs locally (`npm run dev` on
localhost) there's nothing for it to reach. Once the app is deployed
somewhere with a public URL:

1. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (or swap in a different
   provider inside the route handler) in the deployed environment.
2. In the Supabase Dashboard: **Database → Webhooks → Create a new hook**.
   - Table: `notifications`, event: `Insert`.
   - Type: HTTP Request, method `POST`.
   - URL: `https://<your-deployed-app>/api/v1/webhooks/notifications-dispatch`
   - HTTP header: `x-webhook-secret` = the value of `NOTIFICATIONS_WEBHOOK_SECRET`.

Until then, the route itself is fully implemented and testable directly
(e.g. with curl, sending a payload shaped like `{"record": {"id": "...",
"user_id": "...", "title": "...", "body": "..."}}` plus the
`x-webhook-secret` header) — it checks the recipient's
`notification_preferences.email_enabled`, and if `RESEND_API_KEY` isn't set
it logs what it would have sent instead of failing.

## Notes

- These endpoints use a service-role connection after validating the API
  key, so they bypass the app's per-user role/permission system entirely —
  access control here is just "does this key exist, is it revoked, does it
  have write access." Scope what you hand out accordingly.
- Movements posted via the API are attributed in `note` (e.g. `"via API key
  <id>"`) rather than to a specific app user, since API keys aren't tied to
  a profile.
- More resources (suppliers, purchase orders, etc.) can follow the same
  pattern in `src/app/api/v1/*` + `src/lib/apiAuth.ts` if you need them.
