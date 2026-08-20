import { getPermissions } from "@/lib/auth/permissions";
import { getQuickbooksConnectionStatus, disconnectQuickbooks } from "@/actions/quickbooks";
import { getPendingChanges } from "@/actions/quickbooksSync";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PendingChangesList, SyncNowButton } from "./_components/SyncControls";

// Matches the cron route's maxDuration -- the "Run sync now" button on this
// page invokes runSyncNow(), which can take a while on a full catalog sync.
export const maxDuration = 60;

const STATUS_MESSAGES: Record<string, { tone: "error" | "primary"; text: string }> = {
  declined: { tone: "error", text: "The QuickBooks connection was declined." },
  invalid_request: { tone: "error", text: "That connection attempt looked invalid and was rejected. Try connecting again." },
  token_exchange_failed: { tone: "error", text: "QuickBooks didn't accept the connection request. Try again." },
  verification_failed: { tone: "error", text: "Connected, but the test call to confirm it actually worked failed. Try again." },
  save_failed: { tone: "error", text: "QuickBooks authorized the connection, but saving it here failed. Try again." },
  connected: { tone: "primary", text: "Connected to QuickBooks." },
};

export default async function QuickbooksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const permissions = await getPermissions();

  if (permissions.quickbooks?.view !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view the QuickBooks connection.
      </p>
    );
  }

  const connection = await getQuickbooksConnectionStatus();
  const canConnect = permissions.quickbooks?.create === true;
  const canDisconnect = permissions.quickbooks?.delete === true;
  const canSync = permissions.quickbooks?.edit === true;
  const statusMessage = status ? STATUS_MESSAGES[status] : undefined;
  const pendingChanges = connection.connected && canSync ? await getPendingChanges() : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">QuickBooks</h1>
        <p className="text-sm text-on-surface-variant">
          Connects to your QuickBooks Online company and keeps the catalog in sync. New or changed items detected
          in QuickBooks wait here for review before they touch your data -- nothing is written automatically.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            statusMessage.tone === "error"
              ? "border-error/30 bg-error-container/30 text-on-error-container"
              : "border-primary/30 bg-primary-container/30 text-on-surface"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <Card className="max-w-xl">
        {connection.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge tone="primary">Connected</Badge>
              <p className="text-on-surface">{connection.companyName ?? "QuickBooks company"}</p>
            </div>
            <p className="text-sm text-on-surface-variant">
              Company ID: <span className="font-mono">{connection.realmId}</span>
            </p>
            <p className="text-sm text-on-surface-variant">
              Connected since {new Date(connection.connectedAt).toLocaleString()}
            </p>
            {canDisconnect && (
              <form action={disconnectQuickbooks}>
                <button type="submit" className="text-sm text-error underline underline-offset-2">
                  Disconnect
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge tone="neutral">Not connected</Badge>
            </div>
            {canConnect ? (
              <a
                href="/api/integrations/quickbooks/connect"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-on-primary shadow-sm transition-colors hover:shadow-md hover:brightness-110"
              >
                Connect to QuickBooks
              </a>
            ) : (
              <p className="text-sm text-on-surface-variant">
                Only an admin who can create QuickBooks connections can set this up.
              </p>
            )}
          </div>
        )}
      </Card>

      {connection.connected && canSync && (
        <Card className="max-w-3xl">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-on-surface">Catalog sync</h2>
                <p className="text-sm text-on-surface-variant">
                  {connection.lastItemSyncAt
                    ? `Last synced ${new Date(connection.lastItemSyncAt).toLocaleString()}`
                    : "Never synced yet -- runs automatically once a day, or trigger it now."}
                </p>
              </div>
              <SyncNowButton />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-on-surface">
                Pending review {pendingChanges.length > 0 && `(${pendingChanges.length})`}
              </h3>
              <PendingChangesList changes={pendingChanges} />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
