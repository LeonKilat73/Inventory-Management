import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRoutePermission } from "@/lib/auth/routeAuth";
import { getSiteOrigin } from "@/lib/getSiteOrigin";
import { getAuthorizeUrl } from "@/lib/quickbooks/oauth";

const STATE_COOKIE = "qbo_oauth_state";

// Admin clicks "Connect to QuickBooks" on /admin/quickbooks -> lands here ->
// redirected to Intuit's consent screen. state is a random value stored in
// a short-lived cookie and checked again in the callback, so the callback
// can't be triggered by a forged request from somewhere else (standard
// OAuth CSRF protection).
export async function GET() {
  const auth = await requireRoutePermission("quickbooks", "create");
  if ("response" in auth) return auth.response;

  const state = randomUUID();
  // A missing QBO_* variable (typical on a fresh server) used to surface as a
  // bare 500; send the admin back to the page with a readable message instead.
  let authorizeUrl: string;
  try {
    authorizeUrl = getAuthorizeUrl(state);
  } catch (err) {
    console.error("QuickBooks connect failed:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL("/admin/quickbooks?status=not_configured", await getSiteOrigin()));
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
