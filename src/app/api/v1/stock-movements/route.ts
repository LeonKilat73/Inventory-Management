import type { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { recordStockMovement } from "@/lib/stock/ledger";
import { stockMovementSchema } from "@/lib/validation/stockMovement";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if ("error" in auth) return auth.error;

  const itemId = request.nextUrl.searchParams.get("itemId");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 200);

  let query = auth.supabase
    .from("stock_movements")
    .select("id, item_id, quantity_delta, movement_type, note, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (itemId) query = query.eq("item_id", itemId);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ movements: data });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request, { requireWrite: true });
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = stockMovementSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  try {
    await recordStockMovement(auth.supabase, {
      itemId: parsed.data.itemId,
      movementType: parsed.data.movementType,
      direction: parsed.data.direction,
      quantity: parsed.data.quantity,
      note: parsed.data.note ? `${parsed.data.note} (via API key ${auth.apiKeyId})` : `via API key ${auth.apiKeyId}`,
      createdBy: null,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Could not record movement." }, { status: 400 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
