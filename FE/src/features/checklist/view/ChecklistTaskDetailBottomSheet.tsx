import { ReactNode, useEffect, useEffectEvent, useRef } from "react";

import { ChecklistItemEditingController } from "../model/checklistEditing";
import {
  ChecklistCategoryViewModel,
  ChecklistTaskViewModel,
} from "../view-model/createChecklistViewModel";
import { containTabFocus } from "./containTabFocus";
import { ChecklistTaskDetailContent } from "./ChecklistTaskDetailContent";
import { ChecklistTaskTitleEditor } from "./ChecklistTaskTitleEditor";
import "./ChecklistTaskDetailBottomSheet.css";

interface ChecklistTaskDetailBottomSheetProps {
  categories: ChecklistCategoryViewModel[];
  categoryTitle: string;
  editing?: ChecklistItemEditingController;
  onClose: () => void;
  onRequestScheduleCreation?: () => void;
  task: ChecklistTaskViewModel;
}

interface ChecklistTaskDetailBottomSheetShellProps {
  children: ReactNode;
  onClose: () => void;
  title: ReactNode;
  titleId?: string;
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function ChecklistTaskDetailBottomSheetShell({
  children,
  onClose,
  title,
  titleId = "checklist-task-detail-bottom-sheet-title",
}: ChecklistTaskDetailBottomSheetShellProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const handleClose = useEffectEvent(onClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    const scrollContainer = document.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    );
    const previousBodyOverflow = document.body.style.overflow;
    const previousContainerOverflow = scrollContainer?.style.overflow;

    document.body.style.overflow = "hidden";
    if (scrollContainer) {
      scrollContainer.style.overflow = "hidden";
    }
    closeButtonRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dialog?.contains(event.target as Node)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        handleClose();
        return;
      }

      containTabFocus(event, dialog);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (scrollContainer) {
        scrollContainer.style.overflow = previousContainerOverflow ?? "";
      }
    };
  }, []);

  return (
    <div className="checklist-detail-bottom-sheet">
      <button
        aria-label="할 일 상세 닫기"
        className="checklist-detail-bottom-sheet__scrim"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="checklist-detail-bottom-sheet__dialog"
        id="checklist-task-detail-bottom-sheet"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div
          aria-hidden="true"
          className="checklist-detail-bottom-sheet__handle-area"
        >
          <span className="checklist-detail-bottom-sheet__handle" />
        </div>
        <header className="checklist-detail-bottom-sheet__header">
          {typeof title === "string" ? <h2 id={titleId}>{title}</h2> : title}
          <button
            aria-label="할 일 상세 닫기"
            className="checklist-detail-bottom-sheet__close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function ChecklistTaskDetailBottomSheet({
  categories,
  categoryTitle,
  editing,
  onClose,
  onRequestScheduleCreation,
  task,
}: ChecklistTaskDetailBottomSheetProps) {
  const titleId = `${task.id}-detail-title`;

  return (
    <ChecklistTaskDetailBottomSheetShell
      onClose={onClose}
      title={
        <ChecklistTaskTitleEditor
          editing={editing}
          task={task}
          titleId={titleId}
        />
      }
      titleId={titleId}
    >
      <ChecklistTaskDetailContent
        categories={categories}
        categoryTitle={categoryTitle}
        editing={editing}
        onRequestScheduleCreation={onRequestScheduleCreation}
        task={task}
      />
    </ChecklistTaskDetailBottomSheetShell>
  );
}
