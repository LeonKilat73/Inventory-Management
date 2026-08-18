import { getCurrentUser, hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

type Row = {
  created_at: string;
  quantity_delta: number;
  movement_type: string;
  note: string | null;
  items: { name: string; sku: string } | { name: string; sku: string }[] | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

// Exports the full ledger, not just the 100 most recent rows the on-screen
// page shows -- the whole point of exporting is getting the complete
// record, not a UI convenience slice.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await hasPermission("stock_movements", "view"))) return new Response("Forbidden", { status: 403 });

  const supabase = await createClient();
  const { data: movements } = await supabase
    .from("stock_movements")
    .select("created_at, quantity_delta, movement_type, note, items(name, sku), profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(50000)
    .returns<Row[]>();

  const rows = (movements ?? []).map((m) => {
    const item = Array.isArray(m.items) ? m.items[0] : m.items;
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      date: new Date(m.created_at).toLocaleString(),
      item: item?.name ?? "",
      sku: item?.sku ?? "",
      type: m.movement_type.replace(/_/g, " "),
      change: m.quantity_delta,
      note: m.note ?? "",
      by: profile?.full_name ?? "System",
    };
  });

  const csv = toCsv(rows, [
    { key: "date", header: "Date" },
    { key: "item", header: "Item" },
    { key: "sku", header: "SKU" },
    { key: "type", header: "Type" },
    { key: "change", header: "Change" },
    { key: "note", header: "Note" },
    { key: "by", header: "By" },
  ]);

  return csvResponse(csv, `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`);
}
