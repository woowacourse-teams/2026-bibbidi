import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { IconButton } from "../../../components/icon-button";
import { MoreHorizontalIcon } from "../../../components/icons/ActionIcons";
import { Menu } from "../../../components/menu";
import type { ChecklistItemEditingController } from "../model/checklistEditing";
import type { ChecklistTaskViewModel } from "../view-model/createChecklistViewModel";
import { ChecklistTaskTitleEditor } from "./ChecklistTaskTitleEditor";
import "./ChecklistTaskHeader.css";

interface ChecklistTaskHeaderProps {
  editing?: Pick<
    ChecklistItemEditingController,
    | "changeFeedback"
    | "changeTitle"
    | "clearError"
    | "finishTitleEditing"
    | "requestDelete"
    | "startTitleEditing"
    | "titleEditSession"
    | "updateTitleDraft"
  >;
  task: Pick<
    ChecklistTaskViewModel,
    "canEditTitle" | "canDelete" | "checklistItemId" | "id" | "title"
  >;
  titleId: string;
  heading?: ReactNode;
}

export function ChecklistTaskHeader({
  editing,
  task,
  titleId,
  heading,
}: ChecklistTaskHeaderProps) {
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreMenuFocus = useRef(false);
  const itemId = task.checklistItemId;
  const canEditTitle = task.canEditTitle && itemId !== null && !!editing;
  const canDelete =
    task.canDelete && itemId !== null && !!editing?.requestDelete;
  const titleSession = editing?.titleEditSession;
  const isEditing = canEditTitle && titleSession?.itemId === itemId;
  const feedback = editing?.changeFeedback;
  const isSaving = feedback?.status === "pending";
  const titleError =
    feedback?.status === "error" &&
    feedback.itemId === itemId &&
    feedback.kind === "title"
      ? feedback.errorMessage
      : undefined;

  useEffect(() => {
    if (!isEditing && restoreMenuFocus.current) {
      restoreMenuFocus.current = false;
      menuTriggerRef.current?.focus();
    }
  }, [isEditing]);

  if (isEditing && editing && itemId !== null) {
    return (
      <ChecklistTaskTitleEditor
        key={itemId}
        taskId={task.id}
        title={task.title}
        titleId={titleId}
        draft={titleSession.draft}
        errorMessage={titleError}
        isSaving={isSaving}
        onDraftChange={(draft) => {
          editing.updateTitleDraft(itemId, draft);
          editing.clearError(itemId);
        }}
        onSave={(title) => editing.changeTitle(itemId, title)}
        onFinish={() => {
          restoreMenuFocus.current = true;
          editing.finishTitleEditing(itemId);
          editing.clearError(itemId);
        }}
      />
    );
  }

  if (itemId === null || !editing || (!canEditTitle && !canDelete)) {
    return heading ?? <h2 id={titleId}>{task.title}</h2>;
  }

  return (
    <div className="checklist-task-header">
      <Menu
        aria-label="할 일 메뉴"
        width={160}
        trigger={
          <IconButton
            icon={<MoreHorizontalIcon />}
            iconSize={20}
            aria-label="할 일 더보기"
            disabled={isSaving}
            ref={menuTriggerRef}
          />
        }
      >
        {canEditTitle && (
          <Menu.Item
            onSelect={() => {
              editing.startTitleEditing(itemId, task.title);
              editing.clearError(itemId);
            }}
          >
            제목 변경
          </Menu.Item>
        )}
        {canDelete && (
          <Menu.Item
            tone="critical"
            onSelect={() => editing.requestDelete?.(itemId)}
          >
            삭제
          </Menu.Item>
        )}
      </Menu>
      {heading ?? <h2 id={titleId}>{task.title}</h2>}
    </div>
  );
}
