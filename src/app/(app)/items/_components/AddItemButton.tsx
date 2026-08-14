"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ItemForm } from "./ItemForm";
import { createItem } from "@/actions/items";

type Category = { id: string; name: string };

export function AddItemButton({ categories }: { categories: Category[] }) {
  return (
    <Modal
      title="New item"
      trigger={(open) => (
        <Button type="button" onClick={open}>
          + Add Item
        </Button>
      )}
    >
      {(close) => (
        <ItemForm action={createItem} categories={categories} submitLabel="Create item" onSuccess={close} />
      )}
    </Modal>
  );
}
