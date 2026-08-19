import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/apiAuth";
import { returnSchema } from "@/lib/validation/sale";

const referenceSchema = z.string().uuid();

// Reverses specific line(s) of a sale by quantity -- a partial return,
// unlike POST /api/v1/sales/:reference/void which reverses the whole sale.
// Same atomicity/authorization posture as void: the whole request either
// fully applies or fails with nothing recorded (see
// fn_partial_return_pos_sale), and whether the caller is *allowed* to
// return a given line (e.g. a POS's own manager-PIN gate) is entirely the
// caller's responsibility -- this endpoint only checks write access.
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const auth = await authenticateApiKey(request, { requireWrite: true });
  if ("error" in auth) return auth.error;

  const { reference } = await params;
  const parsedReference = referenceSchema.safeParse(reference);
  if (!parsedReference.success) {
    return Response.json({ error: "reference must be a UUID." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = returnSchema.safeParse(body);
  if (!parsedBody.success) {
    return Response.json({ error: parsedBody.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { data, error } = await auth.supabase.rpc("fn_partial_return_pos_sale", {
    p_reference: parsedReference.data,
    p_lines: parsedBody.data.lines.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      constituents: line.constituents ?? null,
    })),
    p_note: parsedBody.data.note ?? null,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const movementIds = ((data ?? []) as { movement_id: string }[]).map((row) => row.movement_id);
  return Response.json({ ok: true, movementIds });
}
