"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/requirePermission";
import { MODULES, ACTIONS } from "@/lib/auth/types";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

async function getSiteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// Admin-driven onboarding: creates the auth user and sends them an email to
// set their own password, rather than the admin choosing one. handle_new_user
// bootstraps the profile with a default role first (staff, unless this
// happens to be the very first user ever); we immediately overwrite that
// with whatever role the admin picked in the form.
export async function inviteUser(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("users", "create");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "");

  if (!fullName || !email || !roleId) {
    return { error: "Name, email, and role are required." };
  }

  const origin = await getSiteOrigin();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: error.message };

  const supabase = await createClient();
  const { error: roleError } = await supabase
    .from("profiles")
    .update({ role_id: roleId })
    .eq("id", data.user.id);

  if (roleError) return { error: roleError.message };

  revalidatePath("/admin/users");
  return ok;
}

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
