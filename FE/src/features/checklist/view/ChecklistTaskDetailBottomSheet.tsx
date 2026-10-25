import { ReactNode } from "react";

import { BottomSheet } from "../../../shared/bottom-sheet/BottomSheet";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistAppointmentManagementController } from "../useChecklistAppointmentManagement";
import {
  ChecklistCategoryViewModel,
  ChecklistTaskViewModel,
} from "../view-model/createChecklistViewModel";
import { ChecklistTaskDetailContent } from "./ChecklistTaskDetailContent";
import { ChecklistTaskHeader } from "./ChecklistTaskHeader";
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
  return (
    <BottomSheet
      className="checklist-detail-bottom-sheet"
      closeLabel="할 일 상세 닫기"
      id="checklist-task-detail-bottom-sheet"
      onClose={onClose}
      title={title}
      titleId={titleId}
    >
      {children}
    </BottomSheet>
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
        <ChecklistTaskHeader editing={editing} task={task} titleId={titleId} />
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
