import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { revokeApiKey } from "@/actions/apiKeys";
import { CreateApiKeyForm } from "./_components/CreateApiKeyForm";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function ApiKeysPage() {
  const permissions = await getPermissions();

  if (permissions.api_keys?.view !== true) {
    return (
      <p className="text-sm text-on-surface-variant">
        You don&apos;t have permission to view API keys.
      </p>
    );
  }

  const supabase = await createClient();
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, can_write, created_at, revoked_at")
    .order("created_at", { ascending: false });

  const canCreate = permissions.api_keys?.create === true;
  const canRevoke = permissions.api_keys?.delete === true;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">API Keys</h1>
        <p className="text-sm text-on-surface-variant">
          For external applications (like a POS) to read the catalog and post
          stock movements. See{" "}
          <code className="rounded bg-surface-container-high px-1 py-0.5 text-xs">API.md</code>{" "}
          in the repo for endpoint docs.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/60">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high text-left text-on-surface-variant">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Access</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              {canRevoke && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {keys?.map((k) => (
              <tr key={k.id} className="border-t border-outline-variant/60 bg-surface-container-lowest">
                <td className="px-4 py-3">{k.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{k.key_prefix}…</td>
                <td className="px-4 py-3">
                  <Badge tone={k.can_write ? "tertiary" : "neutral"}>
                    {k.can_write ? "Read + write" : "Read only"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={k.revoked_at ? "error" : "primary"}>
                    {k.revoked_at ? "Revoked" : "Active"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {new Date(k.created_at).toLocaleDateString()}
                </td>
                {canRevoke && (
                  <td className="px-4 py-3 text-right">
                    {!k.revoked_at && (
                      <form action={revokeApiKey.bind(null, k.id)}>
                        <button type="submit" className="text-sm text-error underline underline-offset-2">
                          Revoke
                        </button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!keys?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">
                  No API keys yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <Card className="max-w-xl">
          <h2 className="mb-4 text-lg font-medium text-on-surface">New API key</h2>
          <CreateApiKeyForm />
        </Card>
      )}
    </div>
  );
}
