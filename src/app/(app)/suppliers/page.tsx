import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { createSupplier, deleteSupplier } from "@/actions/suppliers";
import { SupplierForm } from "./_components/SupplierForm";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const permissions = await getPermissions();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, contact_name, email, phone, is_active")
    .order("name");

  const canCreate = permissions.suppliers?.create === true;
  const canEdit = permissions.suppliers?.edit === true;
  const canDelete = permissions.suppliers?.delete === true;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">Suppliers</h1>
        <p className="text-sm text-on-surface-variant">
          Vendors you order stock from. Linked to purchase orders.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {(canEdit || canDelete) && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {suppliers?.map((s) => (
              <tr
                key={s.id}
                className="border-t border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low"
              >
                <td className="px-4 py-3">{s.name}</td>
                <td className="px-4 py-3 text-on-surface-variant">{s.contact_name ?? "—"}</td>
                <td className="px-4 py-3 text-on-surface-variant">{s.email ?? "—"}</td>
                <td className="px-4 py-3 text-on-surface-variant">{s.phone ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={s.is_active ? "tertiary" : "neutral"}>
                    {s.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                {(canEdit || canDelete) && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-4">
                      {canEdit && (
                        <Link
                          href={`/suppliers/${s.id}`}
                          className="text-primary underline underline-offset-2"
                        >
                          Edit
                        </Link>
                      )}
                      {canDelete && (
                        <form action={deleteSupplier.bind(null, s.id)}>
                          <button
                            type="submit"
                            className="text-error underline underline-offset-2"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!suppliers?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">
                  No suppliers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <Card className="max-w-xl">
          <h2 className="mb-4 text-lg font-medium text-on-surface">New supplier</h2>
          <SupplierForm action={createSupplier} submitLabel="Create supplier" />
        </Card>
      )}
    </div>
  );
}
