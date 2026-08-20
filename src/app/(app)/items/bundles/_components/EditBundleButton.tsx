"use client";

import { Modal } from "@/components/ui/Modal";
import { updateBundle } from "@/actions/items";
import { BundleForm } from "./BundleForm";

type Item = { id: string; name: string; sku: string };
type Category = { id: string; name: string };

export function EditBundleButton({
  bundle,
  items,
  categories,
}: {
  bundle: {
    id: string;
    sku: string;
    name: string;
    categoryId: string | null;
    bundlePrice: number;
    constituents: Array<{ itemId: string; quantity: number }>;
  };
  items: Item[];
  categories: Category[];
}) {
  return (
    <Modal
      title="Edit bundle"
      trigger={(open) => (
        <button type="button" onClick={open} className="text-sm text-primary underline underline-offset-2">
          Edit
        </button>
      )}
    >
      {(close) => (
        <BundleForm
          action={updateBundle}
          items={items}
          categories={categories}
          defaults={{
            id: bundle.id,
            sku: bundle.sku,
            name: bundle.name,
            categoryId: bundle.categoryId,
            bundlePrice: bundle.bundlePrice,
            constituents: bundle.constituents,
          }}
          submitLabel="Save changes"
          onSuccess={close}
        />
      )}
    </Modal>
  );
}
