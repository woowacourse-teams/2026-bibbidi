import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistAppointmentManagementController } from "../useChecklistAppointmentManagement";
import {
  ChecklistCategoryViewModel,
  ChecklistTaskViewModel,
} from "../view-model/createChecklistViewModel";
import { ChecklistTaskDetailContent } from "./ChecklistTaskDetailContent";
import { ChecklistTaskTitleEditor } from "./ChecklistTaskTitleEditor";
import "./ChecklistTaskDetailPanel.css";

interface ChecklistTaskDetailPanelProps {
  modal?: boolean;
  categories: ChecklistCategoryViewModel[];
  categoryTitle: string;
  appointmentManagement?: ChecklistAppointmentManagementController;
  editing?: ChecklistItemEditingController;
  onClose: () => void;
  onRequestScheduleCreation?: () => void;
  task: ChecklistTaskViewModel;
}

export function ChecklistTaskDetailPanel({
  modal = false,
  appointmentManagement,
  categories,
  categoryTitle,
  editing,
  onClose,
  onRequestScheduleCreation,
  task,
}: ChecklistTaskDetailPanelProps) {
  const titleId = `${task.id}-detail-title`;

  return (
    <aside
      role={modal ? "dialog" : "complementary"}
      aria-modal={modal ? true : undefined}
      aria-labelledby={titleId}
      className="checklist-detail-panel"
      id="checklist-task-detail-panel"
    >
      <header className="checklist-detail-panel__header">
        <ChecklistTaskTitleEditor
          editing={editing}
          task={task}
          titleId={titleId}
        />
        <button
          aria-label="할 일 상세 닫기"
          className="checklist-detail-panel__close"
          onClick={onClose}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <ChecklistTaskDetailContent
        appointmentManagement={appointmentManagement}
        categories={categories}
        categoryTitle={categoryTitle}
        editing={editing}
        onRequestScheduleCreation={onRequestScheduleCreation}
        task={task}
      />
    </aside>
  );
}
