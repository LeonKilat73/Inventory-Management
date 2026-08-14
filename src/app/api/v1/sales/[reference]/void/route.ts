import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/apiAuth";

const referenceSchema = z.string().uuid();

// Reverses a sale previously recorded via POST /api/v1/sales, identified by
// the same externalReference. Posts one offsetting stock movement per
// original line (atomic -- see fn_record_pos_sale's sibling,
// fn_void_pos_sale). Whether a caller is *allowed* to void a given sale
// (e.g. a POS's own manager-PIN gate) is entirely the caller's
// responsibility -- this endpoint only checks that the API key itself has
// write access, same as every other mutating endpoint here.
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const auth = await authenticateApiKey(request, { requireWrite: true });
  if ("error" in auth) return auth.error;

  const { reference } = await params;
  const parsed = referenceSchema.safeParse(reference);
  if (!parsed.success) {
    return Response.json({ error: "reference must be a UUID." }, { status: 400 });
  }

  const { data, error } = await auth.supabase.rpc("fn_void_pos_sale", { p_reference: parsed.data });
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const movementIds = ((data ?? []) as { movement_id: string }[]).map((row) => row.movement_id);
  return Response.json({ ok: true, movementIds });
}
