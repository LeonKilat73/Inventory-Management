import { z } from "zod";

export const reportDefectiveSchema = z.object({
  itemId: z.string().uuid("Pick an item"),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  relatedPoId: z.string().uuid().optional().or(z.literal("")),
});

export function parseReportDefectiveFormData(formData: FormData) {
  return reportDefectiveSchema.safeParse({
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason") ?? "",
    relatedPoId: formData.get("relatedPoId") ?? "",
  });
}

export const RESOLUTIONS = ["returned_to_supplier", "replaced", "written_off", "restocked"] as const;

export const resolveDefectiveSchema = z.object({
  defectiveId: z.string().uuid(),
  resolution: z.enum(RESOLUTIONS),
});
