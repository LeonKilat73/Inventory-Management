import type { CookieOptions } from "@supabase/ssr";

// @supabase/ssr hardcodes a 400-day maxAge on every auth cookie it writes
// and ignores any shorter value passed via cookieOptions (confirmed in its
// source -- there is no public option for this). Every place this app
// actually writes the cookie (server actions, the proxy's per-request
// refresh, and the browser client) strips maxAge/expires through this
// helper instead, making it a session cookie -- closing the browser (not
// just the tab) requires signing in again next time.
export function asSessionCookie(options?: CookieOptions): CookieOptions {
  if (!options) return {};
  // maxAge: 0 means "delete this cookie now" (e.g. on sign-out) -- that
  // must be preserved as-is, or the cookie would never actually clear.
  if (options.maxAge === 0) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
