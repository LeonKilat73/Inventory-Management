import "server-only";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "./requirePermission";
import type { Action, CurrentUser, Module } from "./types";

// requirePermission throws, which is right for server actions but turns into
// a bare 500 inside an API route handler. Routes use this instead: it returns
// the user, or a ready-made 401/403 Response to hand straight back.
export async function requireRoutePermission(
  module: Module,
  action: Action,
): Promise<{ user: CurrentUser } | { response: Response }> {
  try {
    return { user: await requirePermission(module, action) };
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return { response: Response.json({ error: "You must be signed in." }, { status: 401 }) };
    }
    if (err instanceof ForbiddenError) {
      return { response: Response.json({ error: err.message }, { status: 403 }) };
    }
    throw err;
  }
}
