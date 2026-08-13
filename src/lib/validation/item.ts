import { z } from "zod";

export const itemSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(64),
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  unitCost: z.coerce.number().nonnegative().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  reorderThreshold: z.coerce.number().int().nonnegative().default(0),
  reorderQuantity: z.coerce.number().int().nonnegative().optional(),
});

export type ItemInput = z.infer<typeof itemSchema>;

export function parseItemFormData(formData: FormData) {
  return itemSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    unitCost: formData.get("unitCost") || undefined,
    unitPrice: formData.get("unitPrice") || undefined,
    reorderThreshold: formData.get("reorderThreshold") || 0,
    reorderQuantity: formData.get("reorderQuantity") || undefined,
  });
}

export const bundleSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(64),
  name: z.string().trim().min(1, "Name is required").max(200),
  bundlePrice: z.coerce.number().nonnegative(),
  itemIds: z.array(z.string().uuid()).min(1, "Pick at least one item"),
  quantities: z.array(z.coerce.number().int().positive()),
});

export function parseBundleFormData(formData: FormData) {
  return bundleSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    bundlePrice: formData.get("bundlePrice") || undefined,
    itemIds: formData.getAll("itemId"),
    quantities: formData.getAll("quantity"),
  });
}
