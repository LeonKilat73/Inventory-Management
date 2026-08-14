"use client";

import { Modal } from "@/components/ui/Modal";
import { CategoryForm } from "./CategoryForm";
import { updateCategory } from "@/actions/categories";

type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  sku_prefix: string | null;
  sku_next_number: number;
};

type ParentOption = { id: string; name: string };

export function EditCategoryButton({
  category,
  parentOptions,
}: {
  category: Category;
  parentOptions: ParentOption[];
}) {
  return (
    <Modal
      title="Edit category"
      trigger={(open) => (
        <button type="button" onClick={open} className="text-primary underline underline-offset-2">
          Edit
        </button>
      )}
    >
      {(close) => (
        <CategoryForm
          action={updateCategory}
          defaults={category}
          parentOptions={parentOptions.filter((p) => p.id !== category.id)}
          submitLabel="Save changes"
          onSuccess={close}
        />
      )}
    </Modal>
  );
}
