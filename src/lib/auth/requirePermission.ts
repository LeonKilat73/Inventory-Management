import "server-only";
import { getCurrentUser, hasPermission } from "./permissions";
import type { Action, CurrentUser, Module } from "./types";

export class UnauthenticatedError extends Error {
  constructor() {
    super("You must be signed in to do that.");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(module: Module, action: Action) {
    super(`You don't have permission to ${action} ${module}.`);
    this.name = "ForbiddenError";
  }
}

// Call this first, before doing anything else, in every server action and
// API route handler that mutates or reads privileged data. UI-level
// show/hide (usePermissions()) is UX only -- this is the real gate. See
// node_modules/next/dist/docs/01-app/02-guides/data-security.md
// ("Authentication and authorization") for why page-level checks alone
// aren't enough.
export async function requirePermission(
  module: Module,
  action: Action,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();

  const allowed = await hasPermission(module, action);
  if (!allowed) throw new ForbiddenError(module, action);

  return user;
}
