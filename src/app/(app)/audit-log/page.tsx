import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { AuditDiff } from "./_components/AuditDiff";
import { Badge } from "@/components/ui/Badge";

const ACTION_TONE = {
  insert: "primary",
  update: "secondary",
  delete: "error",
} as const;

const TABLES = [
  "items",
  "bundles",
  "bundle_items",
  "categories",
  "suppliers",
  "purchase_orders",
  "purchase_order_lines",
  "stock_movements",
  "defective_items",
  "calendar_events",
  "expenses",
  "profiles",
  "roles",
  "role_permissions",
  "user_permission_overrides",
  "notification_preferences",
  "api_keys",
];

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;
  const permissions = await getPermissions();

  if (permissions.audit_log?.view !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view the audit log.
      </p>
    );
  }

  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, table_name, record_id, action, changed_by, old_data, new_data, created_at")
    .order("created_at", { ascending: false })
    .limit(150);

  if (table) query = query.eq("table_name", table);

  const { data: rows } = await query;

  const changedByIds = [...new Set((rows ?? []).map((r) => r.changed_by).filter(Boolean))] as string[];
  const { data: profiles } =
    changedByIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", changedByIds)
      : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">Audit Log</h1>
        <p className="text-sm text-on-surface-variant">
          Every insert, update, and delete captured across the system, most recent first.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/audit-log"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !table ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
          }`}
        >
          All
        </Link>
        {TABLES.map((t) => (
          <Link
            key={t}
            href={`/audit-log?table=${t}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              table === t ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">Table</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Changed by</th>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id} className="border-t border-outline-variant/60 bg-surface-container-lowest align-top">
                <td className="px-4 py-3 font-mono text-xs">{r.table_name}</td>
                <td className="px-4 py-3">
                  <Badge tone={ACTION_TONE[r.action as keyof typeof ACTION_TONE]}>{r.action}</Badge>
                </td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {r.changed_by ? (nameById.get(r.changed_by) ?? "Unknown user") : "System"}
                </td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <AuditDiff action={r.action} oldData={r.old_data} newData={r.new_data} />
                </td>
              </tr>
            ))}
            {!rows?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">
                  No audit log entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
