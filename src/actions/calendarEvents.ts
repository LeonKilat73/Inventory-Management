"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { parseCalendarEventFormData } from "@/lib/validation/calendarEvent";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export async function createCalendarEvent(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("calendar", "create");

  const parsed = parseCalendarEventFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").insert({
    title: v.title,
    event_type: v.eventType,
    starts_at: new Date(v.startsAt).toISOString(),
    ends_at: v.endsAt ? new Date(v.endsAt).toISOString() : null,
    related_supplier_id: v.relatedSupplierId || null,
    notes: v.notes || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/calendar");
  return ok;
}

export async function deleteCalendarEvent(id: string) {
  await requirePermission("calendar", "delete");

  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/calendar");
}
