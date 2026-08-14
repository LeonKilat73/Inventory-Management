import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { updateSupplier } from "@/actions/suppliers";
import { SupplierForm } from "../_components/SupplierForm";
import { Card } from "@/components/ui/Card";
import { BackLink } from "@/components/ui/BackLink";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = await params;
  const supabase = await createClient();
  const permissions = await getPermissions();

  if (permissions.suppliers?.edit !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to edit suppliers.
      </p>
    );
  }

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", supplierId)
    .single();

  if (!supplier) notFound();

  return (
    <div className="max-w-xl">
      <BackLink href="/suppliers" label="Suppliers" />
      <Card>
        <h1 className="mb-6 text-2xl font-medium text-on-surface">
          Edit {supplier.name}
        </h1>
        <SupplierForm action={updateSupplier} defaults={supplier} submitLabel="Save changes" />
      </Card>
    </div>
  );
}
