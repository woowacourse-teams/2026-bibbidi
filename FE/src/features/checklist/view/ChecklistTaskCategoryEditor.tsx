import { useRef } from "react";
import { Select } from "../../../components/select";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import {
  ChecklistCategoryViewModel,
  ChecklistTaskViewModel,
} from "../view-model/createChecklistViewModel";

export function ChecklistTaskCategoryEditor({
  categories,
  categoryTitle,
  editing,
  task,
}: {
  categories: Pick<ChecklistCategoryViewModel, "id" | "title">[];
  categoryTitle: string;
  editing?: Pick<
    ChecklistItemEditingController,
    | "categoryEditSession"
    | "changeCategory"
    | "changeFeedback"
    | "clearError"
    | "finishCategoryEditing"
    | "startCategoryEditing"
  >;
  task: Pick<
    ChecklistTaskViewModel,
    "canEditCategory" | "categoryId" | "checklistItemId"
  >;
}) {
  const submitting = useRef(false);
  const itemId = task.checklistItemId;
  if (!task.canEditCategory || itemId === null || !editing)
    return categoryTitle;
  const feedback = editing.changeFeedback;
  const pending = feedback.status === "pending";
  const error =
    feedback.status === "error" &&
    feedback.itemId === itemId &&
    feedback.kind === "category"
      ? feedback.errorMessage
      : undefined;
  async function select(value: string) {
    if (pending || submitting.current || !editing || itemId === null) return;
    submitting.current = true;
    editing.clearError(itemId);
    try {
      if (await editing.changeCategory(itemId, value))
        editing.finishCategoryEditing(itemId);
    } finally {
      submitting.current = false;
    }
  }
  return (
    <Select
      label={`카테고리 변경, 현재 ${categoryTitle}`}
      labelHidden
      listLabel="카테고리 선택"
      variant="inline"
      size="medium"
      value={task.categoryId}
      options={categories.map((category) => ({
        value: category.id,
        label: category.title,
      }))}
      open={editing.categoryEditSession?.itemId === itemId}
      closeOnSelect={false}
      onOpenChange={(open) => {
        if (pending) return;
        editing.clearError(itemId);
        if (open) editing.startCategoryEditing(itemId);
        else editing.finishCategoryEditing(itemId);
      }}
      loading={pending}
      error={error}
      onChange={(value) => void select(value)}
    />
  );
}
