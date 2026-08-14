import { z } from "zod";

// Backs POST /api/v1/sales -- a whole POS cart in one call. itemId may be a
// plain item or a bundle (fn_record_pos_sale expands a bundle line into one
// stock_movements row per constituent). externalReference is stored as
// stock_movements.reference_id (uuid), so it's expected to be the POS's own
// order id, not an arbitrary string.
export const saleLineSchema = z.object({
  itemId: z.string().uuid("Each line needs a valid item id"),
  quantity: z.coerce.number().int().positive("Each line quantity must be positive"),
});

export const saleSchema = z.object({
  lines: z.array(saleLineSchema).min(1, "Cart must have at least one line."),
  externalReference: z.string().uuid("externalReference must be a UUID").optional(),
  note: z.string().trim().max(500).optional(),
});
