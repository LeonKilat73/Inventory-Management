"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createBundle } from "@/actions/items";
import { BundleForm } from "./BundleForm";

type Item = { id: string; name: string; sku: string };
type Category = { id: string; name: string };

export function AddBundleButton({ items, categories }: { items: Item[]; categories: Category[] }) {
  return (
    <Modal
      title="New bundle"
      trigger={(open) => (
        <Button type="button" onClick={open}>
          + Add Bundle
        </Button>
      )}
    >
      {(close) => (
        <BundleForm action={createBundle} items={items} categories={categories} submitLabel="Create bundle" onSuccess={close} />
      )}
    </Modal>
  );
}
