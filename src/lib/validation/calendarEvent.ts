import { z } from "zod";

export const EVENT_TYPES = ["delivery", "restock_task", "supplier_meeting", "other"] as const;

export const calendarEventSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  eventType: z.enum(EVENT_TYPES),
  startsAt: z.string().min(1, "Start date/time is required"),
  endsAt: z.string().optional().or(z.literal("")),
  relatedSupplierId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export function parseCalendarEventFormData(formData: FormData) {
  return calendarEventSchema.safeParse({
    title: formData.get("title"),
    eventType: formData.get("eventType"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") ?? "",
    relatedSupplierId: formData.get("relatedSupplierId") ?? "",
    notes: formData.get("notes") ?? "",
  });
}
