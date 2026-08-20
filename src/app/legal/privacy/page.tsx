export const metadata = { title: "Privacy Policy | Inventory System" };

// Public, unauthenticated page -- required by Intuit to unlock QuickBooks
// Online Production API credentials (src/app/(app)/admin/quickbooks). Kept
// factual and specific to what the QuickBooks connection actually does
// (src/lib/quickbooks/**), rather than generic boilerplate, since that's
// what Intuit's review is actually checking for.
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-medium text-on-surface">Privacy Policy</h1>
      <p className="mt-2 text-sm text-on-surface-variant">Inventory System — internal business software</p>

      <div className="mt-8 space-y-5 text-sm leading-relaxed text-on-surface">
        <p>
          Inventory System is internal software used only by the staff of this car accessories retail business. It
          is not distributed to, or used by, any other company or member of the public, and this policy describes
          how it handles data for that single business only.
        </p>

        <h2 className="text-base font-medium text-on-surface">QuickBooks Online connection</h2>
        <p>
          With explicit authorization from this business&apos;s own administrator, Inventory System connects to
          this business&apos;s own QuickBooks Online company to read company information, product/item records,
          and sales transaction history. This connection exists solely to help keep this business&apos;s own
          product catalog and sales reporting accurate and up to date across its Inventory and point-of-sale
          systems.
        </p>
        <p>
          Data read from QuickBooks Online is used only for that internal purpose. It is not sold, rented, shared
          with advertisers, or made available to any third party. It is not used for any purpose outside running
          this business&apos;s own operations.
        </p>

        <h2 className="text-base font-medium text-on-surface">Storage and access</h2>
        <p>
          Data is stored in this business&apos;s own private database and is accessible only to its own
          authorized staff, based on the role-based permissions already configured within the application. The
          QuickBooks connection&apos;s access credentials are stored securely and are never exposed to end users
          or logged in plain text.
        </p>
        <p>
          An administrator of this business can disconnect the QuickBooks connection at any time from within the
          application, immediately revoking its access.
        </p>

        <h2 className="text-base font-medium text-on-surface">Contact</h2>
        <p>Questions about this policy should be directed to this business&apos;s own management.</p>
      </div>
    </main>
  );
}
