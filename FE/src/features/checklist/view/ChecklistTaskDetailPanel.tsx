import { ChecklistTaskViewModel } from "../view-model/createChecklistViewModel";
import { ChecklistTaskDetailContent } from "./ChecklistTaskDetailContent";
import "./ChecklistTaskDetailPanel.css";

interface ChecklistTaskDetailPanelProps {
  categoryTitle: string;
  onClose: () => void;
  task: ChecklistTaskViewModel;
}

export function ChecklistTaskDetailPanel({
  categoryTitle,
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
        <h2 id={titleId}>{task.title}</h2>
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
