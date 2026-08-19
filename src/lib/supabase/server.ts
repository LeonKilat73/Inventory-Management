import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";
import { asSessionCookie } from "./sessionCookie";

// One per request -- create a fresh client, don't cache/reuse across requests.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // @supabase/ssr defaults to PKCE, which ties an email link to a
      // verifier cookie stored in whichever browser *requested* it -- fine
      // for OAuth (same tab, same browser, immediate redirect), but breaks
      // password reset: someone routinely requests a reset on one device and
      // opens the email on another (or a different browser/app entirely),
      // and PKCE has no way to validate that. This app has no OAuth sign-in
      // (email/username + password only), so implicit is the correct flow
      // type throughout -- it makes every email link (reset, invite
      // acceptance) a self-contained token that doesn't depend on where
      // it's opened. Confirmed as the real cause of a live "PKCE code
      // verifier not found" failure on /reset-password: the emailed link's
      // token carried an explicit "pkce_" prefix.
      auth: {
        flowType: "implicit",
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, asSessionCookie(options)),
            );
          } catch {
            // Called from a Server Component -- proxy.ts refreshes the
            // session on every request, so this can be safely ignored.
          }
        },
      },
    },
  );
}
