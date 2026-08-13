import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/auth/permissions";
import { updateItem } from "@/actions/items";
import { ItemForm } from "../_components/ItemForm";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const supabase = await createClient();
  const permissions = await getPermissions();

  if (permissions.items?.edit !== true) {
    return (
      <p className="text-sm text-zinc-500">
        You don&apos;t have permission to edit items.
      </p>
    );
  }

  const [{ data: item }, { data: categories }] = await Promise.all([
    supabase.from("items").select("*").eq("id", itemId).single(),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  if (!item) notFound();

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">
        Edit {item.name}
      </h1>
      <ItemForm
        action={updateItem}
        categories={categories ?? []}
        defaults={item}
        submitLabel="Save changes"
      />
    </div>
  );
}
