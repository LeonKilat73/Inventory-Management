"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { MODULES, ACTIONS } from "@/lib/auth/types";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

// Role default permissions are a checked/unchecked grid (no "inherit" concept
// -- they ARE the default). The admin role is intentionally not editable
// here: fn_has_permission() hardcodes it to always-allow, so editing its
// role_permissions rows would be cosmetic and misleading.
export async function updateRolePermissions(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("roles", "edit");

  const roleId = String(formData.get("roleId") ?? "");
  if (!roleId) return { error: "Missing role id." };

  const supabase = await createClient();

  const { data: role } = await supabase
    .from("roles")
    .select("is_system")
    .eq("id", roleId)
    .single();

  if (role?.is_system) {
    return { error: "The admin role always has full access and can't be edited." };
  }

  const checked: { module: string; action: string }[] = [];
  for (const mod of MODULES) {
    for (const action of ACTIONS) {
      if (formData.get(`perm__${mod}__${action}`) === "on") {
        checked.push({ module: mod, action });
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId);
  if (deleteError) return { error: deleteError.message };

  if (checked.length > 0) {
    const { error: insertError } = await supabase.from("role_permissions").insert(
      checked.map((c) => ({
        role_id: roleId,
        module: c.module,
        action: c.action,
        allowed: true,
      })),
    );
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/admin/roles");
  return ok;
}
