import "server-only";

// QuickBooks Online OAuth 2.0 (authorization code flow). Plain fetch, no
// SDK -- same choice already made for Resend in this project. Requires
// QBO_CLIENT_ID/QBO_CLIENT_SECRET/QBO_REDIRECT_URI. redirect_uri is a fixed
// env var rather than derived from request headers (like getSiteOrigin.ts
// does elsewhere) because Intuit requires it to match the registered value
// character-for-character -- a dynamic origin (preview URL, different host
// header) would produce a mismatch and Intuit would reject the request.
const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const SCOPE = "com.intuit.quickbooks.accounting";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("QBO_CLIENT_ID"),
    redirect_uri: env("QBO_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds, access token
  x_refresh_token_expires_in: number; // seconds, refresh token
};

function basicAuthHeader(): string {
  const raw = `${env("QBO_CLIENT_ID")}:${env("QBO_CLIENT_SECRET")}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? `QuickBooks token request failed (${res.status}).`);
  }
  return json as TokenResponse;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env("QBO_REDIRECT_URI"),
    }),
  );
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}
