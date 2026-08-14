import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

// Paths that don't require a Supabase session cookie: /login itself, and
// /api/* -- the external REST API (src/app/api/v1) authenticates via API
// key (see src/lib/apiAuth.ts), not a browser session, so it must never be
// redirected to /login.
const SESSION_EXEMPT_PATHS = ["/login", "/reset-password", "/api"];

// Refreshes the Supabase auth session on every request and redirects
// unauthenticated users to /login. This is the cheap, request-wide gate --
// it does NOT check module/action permissions (see requirePermission.ts for
// that), only "is there a logged-in user at all."
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isSessionExempt = SESSION_EXEMPT_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isSessionExempt) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: return supabaseResponse as-is (or a new response built from
  // it) so the refreshed auth cookies actually reach the browser.
  return supabaseResponse;
}
