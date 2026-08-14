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

List all active items with their current stock. Optional `?sku=` does an
exact match and returns just that one item (still inside the `items` array).

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

For a bundle (`isBundle: true`), `stock` is the real sellable quantity
(`min(constituent stock / quantity required)` across its parts, not a
number stored on the bundle itself), and the item also carries its parts:

```json
{
  "id": "uuid",
  "sku": "BNDL-DCAM-MNT",
  "isBundle": true,
  "stock": 2,
  "constituents": [
    { "itemId": "uuid", "sku": "DCAM-2000", "name": "1080p Dual-Channel Dash Cam", "quantity": 1 },
    { "itemId": "uuid", "sku": "MNT-5000", "name": "Windshield Suction Mount", "quantity": 1 }
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

### `POST /api/v1/sales`

Record a whole cart in one call (requires a read + write key) — the intended
entry point for a POS checkout. `itemId` on a line may be a plain item **or
a bundle**; a bundle line is expanded into one stock movement per
constituent automatically. The whole cart is atomic: if any line would take
an item negative, the entire call fails and **nothing** is recorded — a
sale never half-applies.

Request body:

```json
{
  "lines": [
    { "itemId": "uuid-of-a-plain-item", "quantity": 2 },
    { "itemId": "uuid-of-a-bundle", "quantity": 1 }
  ],
  "externalReference": "uuid-of-your-own-order-id",
  "note": "Register 1, cashier Jhon"
}
```

`externalReference` is optional but recommended — it's stored on every
resulting `stock_movements` row (`reference_table = "pos_sale"`,
`reference_id = <externalReference>`) so a sale is traceable back to your
own order record. It must be a UUID (e.g. your POS order's own id) — plain
text order numbers aren't accepted here since it's stored in a `uuid`
column, not a text one.

Response: `201 { "ok": true, "movementIds": ["uuid", "uuid", ...] }` — one
id per stock movement actually created (a bundle line produces several).
`400 { "error": "..." }` names which item/bundle couldn't be sold and why
(e.g. `"Only 1 of DCAM-2000 in stock -- can't sell 2 of bundle
BNDL-DCAM-MNT."`), with no partial effect on stock.

### `POST /api/v1/sales/:reference/void`

Reverses a sale previously recorded via `POST /api/v1/sales`, identified by
the same `externalReference` you sent then (requires a read + write key).
Posts one offsetting `replacement_in` movement per original line — stock
goes back up by exactly what the sale took out. Atomic, same as recording
the sale in the first place.

Whether the caller is *allowed* to void a given sale (e.g. a POS's own
manager-approval step) is entirely up to the caller — this endpoint only
checks that the API key has write access, same as every other write here.

Response: `200 { "ok": true, "movementIds": [...] }`. `400 { "error": "..."
}` if `:reference` isn't a UUID, if no sale is found for it, or if it's
already been voided (voiding the same reference twice is rejected, not
silently repeated).

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
