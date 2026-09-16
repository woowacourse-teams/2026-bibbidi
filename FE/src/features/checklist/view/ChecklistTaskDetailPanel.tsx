import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistTaskViewModel } from "../view-model/createChecklistViewModel";
import { ChecklistTaskDetailContent } from "./ChecklistTaskDetailContent";
import { ChecklistTaskTitleEditor } from "./ChecklistTaskTitleEditor";
import "./ChecklistTaskDetailPanel.css";

interface ChecklistTaskDetailPanelProps {
  categoryTitle: string;
  editing?: ChecklistItemEditingController;
  onClose: () => void;
  task: ChecklistTaskViewModel;
}

export function ChecklistTaskDetailPanel({
  categoryTitle,
  editing,
  onClose,
  task,
}: ChecklistTaskDetailPanelProps) {
  const titleId = `${task.id}-detail-title`;

  return (
    <aside
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

      <ChecklistTaskDetailContent categoryTitle={categoryTitle} task={task} />
    </aside>
  );
}
