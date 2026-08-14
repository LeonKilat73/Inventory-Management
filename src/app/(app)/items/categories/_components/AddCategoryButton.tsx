"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CategoryForm } from "./CategoryForm";
import { createCategory } from "@/actions/categories";

type ParentOption = { id: string; name: string };

export function AddCategoryButton({ parentOptions }: { parentOptions: ParentOption[] }) {
  return (
    <Modal
      title="New category"
      trigger={(open) => (
        <Button type="button" onClick={open}>
          + Add Category
        </Button>
      )}
    >
      {(close) => (
        <CategoryForm
          action={createCategory}
          parentOptions={parentOptions}
          submitLabel="Create category"
          onSuccess={close}
        />
      )}
    </Modal>
  );
}
