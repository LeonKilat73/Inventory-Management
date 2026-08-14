import { z } from "zod";

export const expenseSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  incurredAt: z.string().min(1, "Date is required"),
});

export function parseExpenseFormData(formData: FormData) {
  return expenseSchema.safeParse({
    amount: formData.get("amount"),
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
    incurredAt: formData.get("incurredAt"),
  });
}
