import { ReactNode } from "react";

import { useBottomSheetDismiss } from "../../../shared/bottom-sheet/useBottomSheetDismiss";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistAppointmentManagementController } from "../useChecklistAppointmentManagement";
import {
  ChecklistCategoryViewModel,
  ChecklistTaskViewModel,
} from "../view-model/createChecklistViewModel";
import { ChecklistTaskDetailContent } from "./ChecklistTaskDetailContent";
import { ChecklistTaskTitleEditor } from "./ChecklistTaskTitleEditor";
import "./ChecklistTaskDetailBottomSheet.css";

interface ChecklistTaskDetailBottomSheetProps {
  categories: ChecklistCategoryViewModel[];
  categoryTitle: string;
  appointmentManagement?: ChecklistAppointmentManagementController;
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

export function ChecklistTaskDetailBottomSheetShell({
  children,
  onClose,
  title,
  titleId = "checklist-task-detail-bottom-sheet-title",
}: ChecklistTaskDetailBottomSheetShellProps) {
  const {
    dialogRef,
    finishDrag,
    handleDragKeyDown,
    handleDragMove,
    handleDragStart,
    handleRef,
    handleTransitionEnd,
    isClosing,
    isDragging,
    requestDismiss,
    rootStyle,
  } = useBottomSheetDismiss({ onDismiss: onClose });

  return (
    <div
      className={`checklist-detail-bottom-sheet bottom-sheet-dismiss${
        isDragging ? " bottom-sheet-dismiss--dragging" : ""
      }${isClosing ? " bottom-sheet-dismiss--closing" : ""}`}
      style={rootStyle}
    >
      <button
        aria-label="할 일 상세 닫기"
        className="checklist-detail-bottom-sheet__scrim bottom-sheet-dismiss__scrim"
        onClick={requestDismiss}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="checklist-detail-bottom-sheet__dialog bottom-sheet-dismiss__dialog"
        id="checklist-task-detail-bottom-sheet"
        onTransitionEnd={handleTransitionEnd}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label="아래로 밀어 할 일 상세 닫기"
          className="checklist-detail-bottom-sheet__handle-area bottom-sheet-dismiss__handle-area"
          onKeyDown={handleDragKeyDown}
          onPointerCancel={finishDrag}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={finishDrag}
          ref={handleRef}
          type="button"
        >
          <span
            aria-hidden="true"
            className="checklist-detail-bottom-sheet__handle bottom-sheet-dismiss__handle"
          />
        </button>
        <header className="checklist-detail-bottom-sheet__header">
          {typeof title === "string" ? <h2 id={titleId}>{title}</h2> : title}
        </header>
        {children}
      </section>
    </div>
  );
}

export function ChecklistTaskDetailBottomSheet({
  appointmentManagement,
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
        appointmentManagement={appointmentManagement}
        categories={categories}
        categoryTitle={categoryTitle}
        editing={editing}
        onRequestScheduleCreation={onRequestScheduleCreation}
        task={task}
      />
    </ChecklistTaskDetailBottomSheetShell>
  );
}
