import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { MovementForm } from "./_components/MovementForm";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type MovementRow = {
  id: string;
  quantity_delta: number;
  movement_type: string;
  note: string | null;
  created_at: string;
  items: { name: string; sku: string } | { name: string; sku: string }[] | null;
};

export default async function StockMovementsPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  if (permissions.stock_movements?.view !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view stock movements.
      </p>
    );
  }

  const [{ data: movements }, { data: items }] = await Promise.all([
    supabase
      .from("stock_movements")
      .select("id, quantity_delta, movement_type, note, created_at, items(name, sku)")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<MovementRow[]>(),
    supabase.from("items").select("id, name, sku").eq("is_bundle", false).order("name"),
  ]);

  const canCreate = permissions.stock_movements?.create === true;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-on-surface">Stock Movements</h1>
          <p className="text-sm text-on-surface-variant">
            Every change to stock, in order. Current stock for any item is the sum
            of this ledger — nothing is ever edited or deleted here.
          </p>
        </div>
        <a
          href="/api/export/stock-movements"
          className="shrink-0 text-sm text-primary underline underline-offset-2"
        >
          Export CSV
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Change</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {movements?.map((m) => {
              const item = Array.isArray(m.items) ? m.items[0] : m.items;
              return (
                <tr
                  key={m.id}
                  className="border-t border-outline-variant/60 bg-surface-container-lowest"
                >
                  <td className="px-4 py-3">
                    {item?.name} <span className="text-on-surface-variant">({item?.sku})</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="neutral">{m.movement_type.replace(/_/g, " ")}</Badge>
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      m.quantity_delta >= 0 ? "text-primary" : "text-error"
                    }`}
                  >
                    {m.quantity_delta >= 0 ? "+" : ""}
                    {m.quantity_delta}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{m.note ?? "—"}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {new Date(m.created_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {!movements?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">
                  No stock movements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <Card className="max-w-xl">
          <h2 className="mb-4 text-lg font-medium text-on-surface">Record a movement</h2>
          <MovementForm items={items ?? []} />
        </Card>
      )}
    </div>
  );
}
