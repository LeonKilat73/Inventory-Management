import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for invite/recovery emails. Supabase's email link points
// here with a `code` query param; exchanging it establishes the session,
// then we hand off to wherever the link asked to go next (defaults to
// setting a password, since that's the only sender of these links today).
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/reset-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid-or-expired-link", request.url));
}
