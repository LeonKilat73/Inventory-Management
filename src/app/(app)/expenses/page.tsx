import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { ExpenseForm } from "./_components/ExpenseForm";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type ExpenseRow = {
  id: string;
  source: "purchase_order" | "manual";
  amount: number;
  category: string | null;
  description: string | null;
  incurred_at: string;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function ExpensesPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  if (permissions.expenses?.view !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view expenses.
      </p>
    );
  }

  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, source, amount, category, description, incurred_at")
    .order("incurred_at", { ascending: false })
    .limit(500)
    .returns<ExpenseRow[]>();

  const now = new Date();
  const todayStr = isoDate(now);

  const startOfWeek = new Date(now);
  const dow = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() + ((dow === 0 ? -6 : 1) - dow));
  const startOfWeekStr = isoDate(startOfWeek);

  const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const startOfYearStr = `${now.getFullYear()}-01-01`;

  const rows = expenses ?? [];
  const sumSince = (since: string) =>
    rows.filter((e) => e.incurred_at >= since).reduce((total, e) => total + Number(e.amount), 0);

  const rollups = [
    { label: "Today", total: sumSince(todayStr) },
    { label: "This week", total: sumSince(startOfWeekStr) },
    { label: "This month", total: sumSince(startOfMonthStr) },
    { label: "This year", total: sumSince(startOfYearStr) },
  ];

  const canCreate = permissions.expenses?.create === true;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">Expenses</h1>
        <p className="text-sm text-on-surface-variant">
          Purchase order receipts post here automatically; add anything else manually.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {rollups.map((r) => (
          <Card key={r.label}>
            <p className="text-sm text-on-surface-variant">{r.label}</p>
            <p className="mt-1 text-2xl font-medium text-on-surface">
              ${r.total.toFixed(2)}
            </p>
          </Card>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-outline-variant/60 bg-surface-container-lowest">
                <td className="px-4 py-3 text-on-surface-variant">{e.incurred_at}</td>
                <td className="px-4 py-3">
                  <Badge tone={e.source === "purchase_order" ? "primary" : "neutral"}>
                    {e.source.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{e.category ?? "—"}</td>
                <td className="px-4 py-3 text-on-surface-variant">{e.description ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-on-surface">${Number(e.amount).toFixed(2)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">
                  No expenses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <Card className="max-w-xl">
          <h2 className="mb-4 text-lg font-medium text-on-surface">Add manual expense</h2>
          <ExpenseForm />
        </Card>
      )}
    </div>
  );
}
