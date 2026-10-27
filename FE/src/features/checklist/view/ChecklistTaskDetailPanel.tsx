import { Panel } from "../../../components/panel";
import { IconButton } from "../../../components/icon-button";
import { CloseIcon } from "../../../components/icons/ActionIcons";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistAppointmentManagementController } from "../useChecklistAppointmentManagement";
import {
  ChecklistCategoryViewModel,
  ChecklistTaskViewModel,
} from "../view-model/createChecklistViewModel";
import { ChecklistTaskDetailContent } from "./ChecklistTaskDetailContent";
import { ChecklistTaskHeader } from "./ChecklistTaskHeader";
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

  const Container = modal ? "div" : "aside";
  return (
    <Container
      aria-labelledby={titleId}
      className="checklist-detail-panel"
      data-presentation={modal ? "overlay" : "docked"}
      id="checklist-task-detail-panel"
    >
      <Panel
        variant={modal ? "edge" : "contained"}
        header={
          <Panel.Header
            heading={
              <ChecklistTaskHeader
                editing={editing}
                task={task}
                titleId={titleId}
              />
            }
            actions={
              <IconButton
                aria-label="할 일 상세 닫기"
                icon={<CloseIcon />}
                onClick={onClose}
              />
            }
          />
        }
      >
        <ChecklistTaskDetailContent
          appointmentManagement={appointmentManagement}
          categories={categories}
          categoryTitle={categoryTitle}
          editing={editing}
          onRequestScheduleCreation={onRequestScheduleCreation}
          task={task}
        />
      </Panel>
    </Container>
  );
}
