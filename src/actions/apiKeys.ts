"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { generateApiKey } from "@/lib/apiKeys";

export type ActionState = { error: string | null; rawKey?: string };

export async function createApiKey(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("api_keys", "create");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  const canWrite = formData.get("canWrite") === "on";

  const { raw, hash, prefix } = generateApiKey();

  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").insert({
    name,
    key_hash: hash,
    key_prefix: prefix,
    can_write: canWrite,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/api-keys");
  return { error: null, rawKey: raw };
}

export async function revokeApiKey(id: string) {
  await requirePermission("api_keys", "delete");

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/api-keys");
}
