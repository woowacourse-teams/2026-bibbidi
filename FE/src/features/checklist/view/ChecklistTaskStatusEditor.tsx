import { useEffect, useRef } from "react";
import { Select } from "../../../components/select";
import { Badge } from "../../../components/badge";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistItemStatus } from "../model/myChecklist";
import { ChecklistTaskViewModel } from "../view-model/createChecklistViewModel";

const options = [
  { label: "예정", value: "prev" },
  { label: "진행 중", value: "continue" },
  { label: "완료", value: "done" },
];
export function ChecklistTaskStatusEditor({
  editing,
  task,
}: {
  editing?: ChecklistItemEditingController;
  task: ChecklistTaskViewModel;
}) {
  const submitting = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const itemId = task.checklistItemId;
  const confirming =
    itemId !== null && editing?.statusConfirmation?.itemId === itemId;
  const wasConfirming = useRef(confirming);
  useEffect(() => {
    if (wasConfirming.current && !confirming) trigger.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  if (!task.isStatusEditable || itemId === null || !editing)
    return (
      <Badge
        color={
          task.status === "complete"
            ? "positive"
            : task.status === "in-progress"
              ? "primary"
              : "dark"
        }
      >
        {task.statusLabel}
      </Badge>
    );
  const feedback = editing.changeFeedback;
  const pending = feedback.status === "pending";
  const error =
    feedback.status === "error" &&
    feedback.itemId === itemId &&
    feedback.kind === "status"
      ? feedback.errorMessage
      : undefined;
  async function select(value: string) {
    if (pending || submitting.current || !editing || itemId === null) return;
    submitting.current = true;
    editing.clearError(itemId);
    try {
      const result = await editing.requestStatusChange(
        itemId,
        value as ChecklistItemStatus,
      );
      if (result !== "failed") editing.finishStatusEditing(itemId);
    } finally {
      submitting.current = false;
    }
  }
  return (
    <Select
      ref={trigger}
      label={`상태 변경, 현재 ${task.statusLabel}`}
      labelHidden
      listLabel="상태 선택"
      variant="inline"
      size="medium"
      value={task.checklistItemStatus}
      options={options}
      open={editing.statusEditSession?.itemId === itemId}
      closeOnSelect={false}
      onOpenChange={(open) => {
        if (pending) return;
        editing.clearError(itemId);
        if (open) editing.startStatusEditing(itemId);
        else editing.finishStatusEditing(itemId);
      }}
      loading={pending}
      error={error}
      onChange={(value) => void select(value)}
    />
  );
}
