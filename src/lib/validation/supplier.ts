import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  contactName: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
});

export function parseSupplierFormData(formData: FormData) {
  return supplierSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
  });
}
