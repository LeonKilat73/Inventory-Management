import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type Approver = { id: string; name: string; email: string };

// Everyone who could actually approve an order: active accounts holding
// purchase_orders.approve (fn_has_permission already folds in active /
// suspended / locked), minus the person creating it -- the creator can never
// approve their own order, so offering themselves would only create an order
// nobody can approve. Read through the service-role client because a creator
// without users.view couldn't otherwise see who the approvers are; only
// name and email leave this function.
export async function getEligibleApprovers(excludeUserId: string): Promise<Approver[]> {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_active", true)
    .neq("id", excludeUserId)
    .order("full_name");

  const checks = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.rpc("fn_has_permission", {
        p_user: p.id,
        p_module: "purchase_orders",
        p_action: "approve",
      });
      return data === true ? ({ id: p.id, name: p.full_name || p.email, email: p.email } as Approver) : null;
    }),
  );
  return checks.filter((a): a is Approver => a !== null);
}
