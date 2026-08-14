"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CategoryForm } from "./CategoryForm";
import { createCategory } from "@/actions/categories";

export function AddCategoryButton() {
  return (
    <Modal
      title="New category"
      trigger={(open) => (
        <Button type="button" onClick={open}>
          + Add Category
        </Button>
      )}
    >
      {(close) => <CategoryForm action={createCategory} submitLabel="Create category" onSuccess={close} />}
    </Modal>
  );
}
