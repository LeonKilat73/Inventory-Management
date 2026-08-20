export const metadata = { title: "End-User License Agreement | Inventory System" };

// Public, unauthenticated page -- required by Intuit to unlock QuickBooks
// Online Production API credentials (src/app/(app)/admin/quickbooks). This
// app is internal-only: built for, and used only by, this shop's own staff
// to run its Inventory and POS systems. It is never distributed, resold, or
// made available to any other business.
export default function EulaPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-medium text-on-surface">End-User License Agreement</h1>
      <p className="mt-2 text-sm text-on-surface-variant">Inventory System — internal business software</p>

      <div className="mt-8 space-y-5 text-sm leading-relaxed text-on-surface">
        <p>
          Inventory System is internal software built for, and used exclusively by, the staff of this car
          accessories retail business, to manage its own product catalog, stock, and point-of-sale operations.
        </p>
        <p>
          This software is not sold, licensed, distributed, or made available to any other company, business, or
          member of the public. It is not a commercial product and has no external customers — its only users are
          this business&apos;s own authorized staff, accessing it with accounts issued internally.
        </p>
        <p>
          Use of this software is governed entirely by this business&apos;s own internal policies. There is no
          separate license grant, fee, or subscription associated with it, and no warranty is made beyond its use
          as an internal operational tool.
        </p>
        <p>
          Questions about this software should be directed to the business&apos;s own management, not to any
          third party.
        </p>
      </div>
    </main>
  );
}
