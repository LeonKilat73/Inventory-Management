import { NextResponse, type NextRequest } from "next/server";
import { runCatalogSync } from "@/lib/quickbooks/sync";

// 60s is the max allowed on the current (Hobby) Vercel plan. A full sync
// against the whole catalog (the first run, or after a long gap) can take
// a while -- see the batching notes in src/lib/quickbooks/sync.ts.
export const maxDuration = 60;

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically for
// its own scheduled invocations (see vercel.json) -- that's the only auth
// this route needs. There's no user session in a cron invocation, so this
// doesn't go through requirePermission() like the admin-triggered sync in
// src/actions/quickbooksSync.ts does; the bearer secret is what keeps this
// endpoint from being triggered by anyone else.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCatalogSync();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("QuickBooks scheduled sync failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Sync failed." }, { status: 500 });
  }
}
