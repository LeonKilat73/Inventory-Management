import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { MODULES, ACTIONS, type CurrentUser, type PermissionMap } from "./types";

// Cached per request (React's cache()) so multiple components/actions in the
// same render/request share one lookup instead of hitting the DB repeatedly.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, is_active, roles(name)")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const role = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles;

  return {
    id: user.id,
    email: profile.email,
    fullName: profile.full_name,
    roleName: role?.name ?? "unknown",
    isActive: profile.is_active,
  };
});

const emptyPermissionMap = (): PermissionMap =>
  Object.fromEntries(MODULES.map((m) => [m, {}])) as PermissionMap;

// One resolve_user_permissions() RPC call per request, resolved server-side
// (role default + per-user override, admin hardcoded true) -- see
// fn_has_permission in supabase/migrations/20260813034630_roles_and_permissions.sql.
export const getPermissions = cache(async (): Promise<PermissionMap> => {
  const user = await getCurrentUser();
  if (!user) return emptyPermissionMap();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_user_permissions", {
    p_user: user.id,
  });

  const map = emptyPermissionMap();
  if (error || !data) return map;

  for (const row of data as { module: string; action: string; allowed: boolean }[]) {
    if ((MODULES as readonly string[]).includes(row.module) && (ACTIONS as readonly string[]).includes(row.action)) {
      map[row.module as (typeof MODULES)[number]][row.action as (typeof ACTIONS)[number]] = row.allowed;
    }
  }
  return map;
});

export async function hasPermission(module: (typeof MODULES)[number], action: (typeof ACTIONS)[number]) {
  const permissions = await getPermissions();
  return permissions[module]?.[action] === true;
}
