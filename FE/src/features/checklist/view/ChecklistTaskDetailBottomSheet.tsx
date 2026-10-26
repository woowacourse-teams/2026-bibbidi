import { useState } from "react";
import type { ReactNode } from "react";

import { BottomSheet } from "../../../components/bottom-sheet";
import { usePageScrollContainer } from "../../../shared/scroll/usePageScrollContainer";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistAppointmentManagementController } from "../useChecklistAppointmentManagement";
import {
  ChecklistCategoryViewModel,
  ChecklistTaskViewModel,
} from "../view-model/createChecklistViewModel";
import { ChecklistTaskDetailContent } from "./ChecklistTaskDetailContent";
import { ChecklistTaskHeader } from "./ChecklistTaskHeader";

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
  const [closing, setClosing] = useState(false);
  const { ref, environment } = usePageScrollContainer();

  return (
    <div ref={ref}>
      {
        <BottomSheet
          scrollContainer={environment?.scrollContainer}
          className="checklist-detail-bottom-sheet"
          id="checklist-task-detail-bottom-sheet"
          open={!closing}
          onClose={() => setClosing(true)}
          onExited={onClose}
          aria-labelledby={titleId}
          hasTextField
          header={
            typeof title === "string" ? (
              <BottomSheet.Header id={titleId}>{title}</BottomSheet.Header>
            ) : (
              title
            )
          }
        >
          {children}
        </BottomSheet>
      }
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
        <ChecklistTaskHeader
          editing={editing}
          task={task}
          titleId={titleId}
          heading={
            <BottomSheet.Header id={titleId}>{task.title}</BottomSheet.Header>
          }
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
