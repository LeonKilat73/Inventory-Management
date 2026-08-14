"use client";

import { Modal } from "@/components/ui/Modal";
import { CategoryForm } from "./CategoryForm";
import { updateCategory } from "@/actions/categories";

type Category = {
  id: string;
  name: string;
  sku_prefix: string | null;
  sku_next_number: number;
};

export function EditCategoryButton({ category }: { category: Category }) {
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
        <CategoryForm action={updateCategory} defaults={category} submitLabel="Save changes" onSuccess={close} />
      )}
    </Modal>
  );
}
