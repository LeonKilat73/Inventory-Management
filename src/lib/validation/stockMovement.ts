import { z } from "zod";

// The manual entry point covers sale/replacement/adjustment. PO receipts and
// defective-item flows post their own movement_type values elsewhere
// (receive_purchase_order_line(), and the Phase 3 defective items flow).
export const MANUAL_MOVEMENT_TYPES = [
  "sale",
  "replacement_out",
  "replacement_in",
  "manual_adjustment",
] as const;

export const stockMovementSchema = z.object({
  itemId: z.string().uuid("Pick an item"),
  movementType: z.enum(MANUAL_MOVEMENT_TYPES),
  direction: z.enum(["increase", "decrease"]).optional(),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export function parseStockMovementFormData(formData: FormData) {
  return stockMovementSchema.safeParse({
    itemId: formData.get("itemId"),
    movementType: formData.get("movementType"),
    direction: formData.get("direction") || undefined,
    quantity: formData.get("quantity"),
    note: formData.get("note") ?? "",
  });
}
