import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens } from "@/lib/quickbooks/oauth";

const STATE_COOKIE = "qbo_oauth_state";

function redirectWithStatus(request: NextRequest, status: string) {
  const url = new URL("/admin/quickbooks", request.url);
  url.searchParams.set("status", status);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

// Intuit redirects here after the admin authorizes (or declines) on its
// consent screen, with ?code&state&realmId on success. Exchanges the code
// for tokens, makes one real CompanyInfo call to prove the connection
// actually works (not just "the token exchange didn't error") and to grab
// the company name for display, then stores the connection.
export async function GET(request: NextRequest) {
  const user = await requirePermission("quickbooks", "create");

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (searchParams.get("error")) {
    return redirectWithStatus(request, "declined");
  }
  if (!code || !realmId || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus(request, "invalid_request");
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (err) {
    console.error("QuickBooks token exchange failed:", err instanceof Error ? err.message : err);
    return redirectWithStatus(request, "token_exchange_failed");
  }

  let companyName: string | null = null;
  try {
    const res = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" } },
    );
    const bodyText = await res.text();
    if (res.ok) {
      const json = JSON.parse(bodyText);
      companyName = json?.CompanyInfo?.CompanyName ?? null;
      if (companyName === null) {
        console.error("QuickBooks CompanyInfo call succeeded but had no CompanyName. Body:", bodyText);
      }
    } else {
      console.error(`QuickBooks CompanyInfo call failed (${res.status}) for realmId ${realmId}. Body:`, bodyText);
    }
  } catch (err) {
    console.error("QuickBooks CompanyInfo call threw:", err instanceof Error ? err.message : err);
  }
  if (companyName === null) {
    return redirectWithStatus(request, "verification_failed");
  }

  const now = Date.now();
  const admin = createAdminClient();
  const { error } = await admin.from("quickbook_connections").insert({
    realm_id: realmId,
    company_name: companyName,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    access_token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
    refresh_token_expires_at: new Date(now + tokens.x_refresh_token_expires_in * 1000).toISOString(),
    connected_by: user.id,
  });
  if (error) {
    return redirectWithStatus(request, "save_failed");
  }

  return redirectWithStatus(request, "connected");
}
