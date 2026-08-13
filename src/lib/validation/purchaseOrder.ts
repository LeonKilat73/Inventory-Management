import { z } from "zod";

export const purchaseOrderSchema = z.object({
  supplierId: z.string().uuid("Pick a supplier"),
  poNumber: z.string().trim().min(1, "PO number is required").max(64),
  expectedAt: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  itemIds: z.array(z.string().uuid()).min(1, "Add at least one line item"),
  quantities: z.array(z.coerce.number().int().positive()),
  unitCosts: z.array(z.coerce.number().nonnegative()),
});

export function parsePurchaseOrderFormData(formData: FormData) {
  return purchaseOrderSchema.safeParse({
    supplierId: formData.get("supplierId"),
    poNumber: formData.get("poNumber"),
    expectedAt: formData.get("expectedAt") ?? "",
    notes: formData.get("notes") ?? "",
    itemIds: formData.getAll("itemId"),
    quantities: formData.getAll("quantity"),
    unitCosts: formData.getAll("unitCost"),
  });
}

export const receiveLineSchema = z.object({
  lineId: z.string().uuid(),
  quantity: z.coerce.number().int().positive("Enter a quantity to receive"),
});
