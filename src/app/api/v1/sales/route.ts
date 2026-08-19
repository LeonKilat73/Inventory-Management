import type { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { saleSchema } from "@/lib/validation/sale";

// Records a whole cart -- plain items and/or bundles -- as one atomic set of
// stock_movements rows via fn_record_pos_sale(). A bundle line expands to
// one row per constituent. If any line would oversell, the entire call
// fails and nothing is inserted -- a cart never half-applies.
export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request, { requireWrite: true });
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = saleSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const note = parsed.data.note
    ? `${parsed.data.note} (via API key ${auth.apiKeyId})`
    : `via API key ${auth.apiKeyId}`;

  const { data, error } = await auth.supabase.rpc("fn_record_pos_sale", {
    p_lines: parsed.data.lines.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      constituents: line.constituents ?? null,
    })),
    p_reference: parsed.data.externalReference ?? null,
    p_note: note,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const movementIds = ((data ?? []) as { movement_id: string }[]).map((row) => row.movement_id);
  return Response.json({ ok: true, movementIds }, { status: 201 });
}
