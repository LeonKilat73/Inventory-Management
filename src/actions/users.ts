"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/requirePermission";
import { MODULES, ACTIONS } from "@/lib/auth/types";
import { getSiteOrigin } from "@/lib/getSiteOrigin";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

const USERNAME_RE = /^[a-z0-9_.]{3,32}$/;

function normalizeUsername(raw: FormDataEntryValue | null): string {
  return String(raw ?? "").trim().toLowerCase();
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
  const username = normalizeUsername(formData.get("username"));

  if (!fullName || !email || !roleId || !username) {
    return { error: "Name, email, username, and role are required." };
  }
  if (!USERNAME_RE.test(username)) {
    return { error: "Username must be 3-32 characters: lowercase letters, numbers, underscore, or period." };
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
    .update({ role_id: roleId, username })
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

export async function updateUsername(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("users", "edit");

  const userId = String(formData.get("userId") ?? "");
  const username = normalizeUsername(formData.get("username"));
  if (!userId) return { error: "Missing user id." };
  if (!USERNAME_RE.test(username)) {
    return { error: "Username must be 3-32 characters: lowercase letters, numbers, underscore, or period." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ username }).eq("id", userId);
  if (error) {
    return {
      error: error.code === "23505" ? "That username is already taken." : error.message,
    };
  }

  revalidatePath(`/admin/users/${userId}`);
  return ok;
}

// Reactivates an account suspended by the failed-login lockout ladder (see
// fn_register_failed_login). Requires the user to have already reset their
// password -- enforced here at the app level, same convention as
// updateUserRole's self-role-change check -- so "unsuspend" can't be used to
// skip that step.
export async function unsuspendUser(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("users", "edit");

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id." };

  const supabase = await createClient();
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("is_suspended, password_reset_required")
    .eq("id", userId)
    .single();

  if (fetchError) return { error: fetchError.message };
  if (!profile.is_suspended) return { error: "This account isn't suspended." };
  if (profile.password_reset_required) {
    return { error: "This user must reset their password before you can reactivate their account." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_suspended: false, locked_until: null, failed_login_count: 0 })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return ok;
}
