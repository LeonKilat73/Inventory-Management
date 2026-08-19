import { z } from "zod";

// Backs POST /api/v1/sales -- a whole POS cart in one call. itemId may be a
// plain item or a bundle (fn_record_pos_sale expands a bundle line into one
// stock_movements row per constituent). externalReference is stored as
// stock_movements.reference_id (uuid), so it's expected to be the POS's own
// order id, not an arbitrary string.
//
// constituents is optional and only meaningful when itemId is a bundle: the
// caller (POS) can override the bundle's own bundle_items recipe with
// exactly what was actually used for this specific sale (a part skipped, or
// swapped for a different item) -- quantity is still per-one-bundle-unit,
// scaled by the line's own quantity same as the recipe would be. Omitted ->
// fn_record_pos_sale falls back to the recipe, unchanged from before.
export const saleLineSchema = z.object({
  itemId: z.string().uuid("Each line needs a valid item id"),
  quantity: z.coerce.number().int().positive("Each line quantity must be positive"),
  constituents: z
    .array(
      z.object({
        itemId: z.string().uuid("Each constituent needs a valid item id"),
        quantity: z.coerce.number().int().positive("Each constituent quantity must be positive"),
      }),
    )
    .optional(),
});

export const saleSchema = z.object({
  lines: z.array(saleLineSchema).min(1, "Cart must have at least one line."),
  externalReference: z.string().uuid("externalReference must be a UUID").optional(),
  note: z.string().trim().max(500).optional(),
});

// Backs POST /api/v1/sales/:reference/return -- returning specific line(s)
// of a previously-recorded sale, by quantity. Same line shape as a sale
// (itemId may be a plain item or a bundle), just without externalReference
// since the reference comes from the URL instead.
export const returnSchema = z.object({
  lines: z.array(saleLineSchema).min(1, "At least one return line is required."),
  note: z.string().trim().max(500).optional(),
});
