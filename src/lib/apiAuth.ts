import "server-only";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/apiKeys";

// External requests carry an API key, not a Supabase session -- so there's
// no auth.uid() and RLS can't be the gate. This check IS the gate: once a
// request passes it, callers use the service-role client (bypasses RLS)
// exactly like the other privileged, multi-table operations in this app.
export async function authenticateApiKey(request: NextRequest, opts: { requireWrite?: boolean } = {}) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    return {
      error: Response.json({ error: "Missing Authorization: Bearer <key> header." }, { status: 401 }),
    } as const;
  }

  const supabase = createAdminClient();
  const { data: key } = await supabase
    .from("api_keys")
    .select("id, can_write, revoked_at")
    .eq("key_hash", hashApiKey(match[1]))
    .is("revoked_at", null)
    .single();

  if (!key) {
    return { error: Response.json({ error: "Invalid or revoked API key." }, { status: 401 }) } as const;
  }

  if (opts.requireWrite && !key.can_write) {
    return {
      error: Response.json({ error: "This API key does not have write access." }, { status: 403 }),
    } as const;
  }

  return { apiKeyId: key.id as string, supabase } as const;
}
