import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { asSessionCookie } from "./sessionCookie";

function parseDocumentCookies(): { name: string; value: string }[] {
  return document.cookie
    .split("; ")
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      return { name: decodeURIComponent(pair.slice(0, eq)), value: decodeURIComponent(pair.slice(eq + 1)) };
    });
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  let str = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  if (options.maxAge !== undefined) str += `; Max-Age=${options.maxAge}`;
  if (options.path) str += `; Path=${options.path}`;
  if (options.sameSite) str += `; SameSite=${options.sameSite}`;
  if (options.secure) str += "; Secure";
  return str;
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // @supabase/ssr's own document.cookie writer hardcodes a 400-day
      // maxAge with no way to override it via cookieOptions (see
      // sessionCookie.ts) -- providing this adapter is the only way to
      // make the browser client's own writes (e.g. a client-side token
      // refresh) session cookies too, matching server.ts/middleware.ts.
      cookies: {
        getAll: () => parseDocumentCookies(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            document.cookie = serializeCookie(name, value, asSessionCookie(options));
          });
        },
      },
    },
  );
}
