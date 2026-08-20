"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/requirePermission";
import { createAdminClient } from "@/lib/supabase/admin";

export type QuickbooksConnectionStatus =
  | { connected: false }
  | {
      connected: true;
      companyName: string | null;
      realmId: string;
      connectedAt: string;
      lastItemSyncAt: string | null;
    };

// Never returns the token columns -- this is the only way the admin page
// learns the connection state, since quickbook_connections has no select
// policy for the authenticated role at all (see the migration).
export async function getQuickbooksConnectionStatus(): Promise<QuickbooksConnectionStatus> {
  await requirePermission("quickbooks", "view");

  const admin = createAdminClient();
  const { data } = await admin
    .from("quickbook_connections")
    .select("realm_id, company_name, connected_at, last_item_sync_at")
    .order("connected_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return { connected: false };
  return {
    connected: true,
    companyName: data.company_name,
    realmId: data.realm_id,
    connectedAt: data.connected_at,
    lastItemSyncAt: data.last_item_sync_at,
  };
}

export async function disconnectQuickbooks(): Promise<void> {
  await requirePermission("quickbooks", "delete");

  const admin = createAdminClient();
  await admin.from("quickbook_connections").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  revalidatePath("/admin/quickbooks");
}
