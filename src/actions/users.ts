"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { MODULES, ACTIONS } from "@/lib/auth/types";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export async function updateUserRole(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actingUser = await requirePermission("users", "edit");

  const userId = String(formData.get("userId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  if (!userId || !roleId) return { error: "Missing user or role id." };

  if (userId === actingUser.id) {
    return { error: "You cannot change your own role. Ask another admin to do it." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role_id: roleId }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return ok;
}

// One submit for the whole module x action grid. "inherit" removes any
// override row so the role default applies again; "grant"/"revoke" upsert an
// explicit true/false override.
export async function updateUserOverrides(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actingUser = await requirePermission("users", "edit");

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id." };

  const supabase = await createClient();

  const toUpsert: { user_id: string; module: string; action: string; allowed: boolean; granted_by: string }[] = [];
  const toDelete: { module: string; action: string }[] = [];

  for (const mod of MODULES) {
    for (const action of ACTIONS) {
      const value = formData.get(`override__${mod}__${action}`);
      if (value === "grant") {
        toUpsert.push({ user_id: userId, module: mod, action, allowed: true, granted_by: actingUser.id });
      } else if (value === "revoke") {
        toUpsert.push({ user_id: userId, module: mod, action, allowed: false, granted_by: actingUser.id });
      } else {
        toDelete.push({ module: mod, action });
      }
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("user_permission_overrides")
      .upsert(toUpsert, { onConflict: "user_id,module,action" });
    if (error) return { error: error.message };
  }

  for (const d of toDelete) {
    const { error } = await supabase
      .from("user_permission_overrides")
      .delete()
      .eq("user_id", userId)
      .eq("module", d.module)
      .eq("action", d.action);
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/users/${userId}`);
  return ok;
}
