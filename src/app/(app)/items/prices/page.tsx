import { getPermissions } from "@/lib/auth/permissions";
import { BackLink } from "@/components/ui/BackLink";
import { PriceImport } from "./_components/PriceImport";

export default async function BulkPricePage() {
  const permissions = await getPermissions();

  if (permissions.items?.edit !== true) {
    return <p className="text-sm text-on-surface-variant">You don&apos;t have permission to edit items.</p>;
  }

  return (
    <div className="space-y-6">
      <BackLink href="/items" label="Items" />

      <div className="max-w-3xl">
        <h1 className="text-2xl font-medium text-on-surface">Bulk price update</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Set prices (and optionally costs) for many items at once from a spreadsheet, instead of editing them one by
          one. You review what will change before anything is saved.
        </p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-on-surface">
          <li>
            Download the list of items that have no price yet:{" "}
            <a href="/api/export/items?missing=price" className="text-primary underline underline-offset-2">
              Items without a price (CSV)
            </a>
            . Or the{" "}
            <a href="/api/export/items" className="text-primary underline underline-offset-2">
              full item list
            </a>{" "}
            to change existing prices.
          </li>
          <li>Open it in Excel, fill in the Unit Price column (and Unit Cost if you want), and save it as CSV.</li>
          <li>Choose the file below, check it, then apply.</li>
        </ol>
        <p className="mt-3 text-xs text-on-surface-variant">
          Rows are matched by SKU, so leave the SKU column as it is. Bundles are skipped. Leave a price blank to keep the
          current one.
        </p>
      </div>

      <PriceImport />
    </div>
  );
}
