import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { getAuthorizeUrl } from "@/lib/quickbooks/oauth";

const STATE_COOKIE = "qbo_oauth_state";

// Admin clicks "Connect to QuickBooks" on /admin/quickbooks -> lands here ->
// redirected to Intuit's consent screen. state is a random value stored in
// a short-lived cookie and checked again in the callback, so the callback
// can't be triggered by a forged request from somewhere else (standard
// OAuth CSRF protection).
export async function GET() {
  await requirePermission("quickbooks", "create");

  const state = randomUUID();
  const response = NextResponse.redirect(getAuthorizeUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
