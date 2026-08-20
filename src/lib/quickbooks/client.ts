import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "./oauth";

// Production API base -- these Development-environment credentials connect
// straight to the real company chosen during OAuth consent (not a sandbox
// company), so the production host is the right one, not sandbox-quickbooks.
const API_BASE = "https://quickbooks.api.intuit.com/v3/company";

// Refresh a bit before actual expiry so a request that starts just under
// the line doesn't get a token that expires mid-flight.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export class QuickbooksNotConnectedError extends Error {
  constructor() {
    super("QuickBooks isn't connected yet.");
    this.name = "QuickbooksNotConnectedError";
  }
}

// Reads the stored connection, transparently refreshing the access token if
// it's near/past expiry. Only ever called from server code that has already
// gone through requirePermission() -- this is the one place outside the
// OAuth callback allowed to touch quickbook_connections' token columns.
export async function getValidAccessToken(): Promise<{ accessToken: string; realmId: string }> {
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("quickbook_connections")
    .select("id, realm_id, access_token, refresh_token, access_token_expires_at")
    .order("connected_at", { ascending: false })
    .limit(1)
    .single();

  if (!connection) throw new QuickbooksNotConnectedError();

  const expiresAt = new Date(connection.access_token_expires_at).getTime();
  if (Date.now() < expiresAt - REFRESH_SKEW_MS) {
    return { accessToken: connection.access_token, realmId: connection.realm_id };
  }

  // Expired or about to be -- refresh and persist the new pair before
  // returning, so the next call doesn't repeat the round trip.
  const tokens = await refreshAccessToken(connection.refresh_token);
  const now = Date.now();
  await admin
    .from("quickbook_connections")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      access_token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
      refresh_token_expires_at: new Date(now + tokens.x_refresh_token_expires_in * 1000).toISOString(),
    })
    .eq("id", connection.id);

  return { accessToken: tokens.access_token, realmId: connection.realm_id };
}

// Thin wrapper for Phase 2/3 callers -- not used by Phase 1 itself beyond
// the one CompanyInfo call the OAuth callback makes to prove the connection
// works.
export async function quickbooksFetch(path: string, init?: RequestInit): Promise<unknown> {
  const { accessToken, realmId } = await getValidAccessToken();
  const res = await fetch(`${API_BASE}/${realmId}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...init?.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.Fault?.Error?.[0]?.Message ?? `QuickBooks request failed (${res.status}).`;
    throw new Error(message);
  }
  return json;
}
