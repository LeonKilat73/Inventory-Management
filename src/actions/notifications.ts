"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/requirePermission";

export async function markNotificationRead(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");

  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) throw new Error(error.message);

  revalidatePath("/notifications");
}

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export async function updateNotificationPreferences(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actingUser = await getCurrentUser();
  if (!actingUser) return { error: "You must be signed in." };

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id." };

  if (userId !== actingUser.id) {
    await requirePermission("users", "edit");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_preferences")
    .update({
      email_enabled: formData.get("emailEnabled") === "on",
      low_stock_alerts: formData.get("lowStockAlerts") === "on",
      item_modified_alerts: formData.get("itemModifiedAlerts") === "on",
    })
    .eq("user_id", userId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/users/${userId}`);
  return ok;
}
