import { PreparationStepTaskViewModel } from "../view-model/createPreparationRoadmapViewModel";
import "./PreparationTaskList.css";

type PreparationTaskListDensity = "compact" | "regular";
type PreparationTaskListVariant = "available" | "checklist";

interface PreparationTaskListProps {
  density?: PreparationTaskListDensity;
  isScrollable?: boolean;
  tasks: PreparationStepTaskViewModel[];
  variant: PreparationTaskListVariant;
}

function PreparationTaskEmptyState({
  density,
  variant,
}: Pick<PreparationTaskListProps, "density" | "variant">) {
  if (variant === "available") {
    return (
      <p
        className={`preparation-task-list__empty preparation-task-list__empty--${density}`}
      >
        추가할 세부 할 일이 없어요.
      </p>
    );
  }

  return (
    <div
      className={`preparation-task-list__empty-checklist preparation-task-list__empty-checklist--${density}`}
    >
      <span aria-hidden="true" className="preparation-task-list__empty-icon">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V2h6v2M8 10l1 1 2-2M13 10h3M8 16l1 1 2-2M13 16h3" />
        </svg>
      </span>
      <h3>이 단계에 추가한 할 일이 없어요.</h3>
      <p>아래 준비할 일에서 필요한 항목을 확인해 보세요.</p>
    </div>
  );
}

export function PreparationTaskList({
  density = "regular",
  isScrollable = false,
  tasks,
  variant,
}: PreparationTaskListProps) {
  if (tasks.length === 0) {
    return <PreparationTaskEmptyState density={density} variant={variant} />;
  }

  return (
    <ul
      aria-label={
        variant === "checklist"
          ? "이 단계에 추가한 할 일"
          : "추가할 수 있는 할 일"
      }
      className={`preparation-task-list preparation-task-list--${variant} preparation-task-list--${density}${isScrollable ? " preparation-task-list--scrollable" : ""}`}
    >
      {tasks.map((task) => (
        <li className="preparation-task-list__item" key={task.id}>
          <span
            aria-hidden="true"
            className={`preparation-task-list__marker preparation-task-list__marker--${variant}`}
          />
          <span className="preparation-task-list__title">{task.title}</span>
          {task.isEssential || variant === "available" ? (
            <span className="preparation-task-list__actions">
              {task.isEssential ? (
                <span className="preparation-task-essential-badge">필수</span>
              ) : null}
              {variant === "available" ? (
                <button
                  aria-label={`${task.title} 추가 (준비 중)`}
                  className="preparation-task-list__add"
                  disabled
                  type="button"
                >
                  <span aria-hidden="true">+ </span>추가
                </button>
              ) : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

interface PreparationAddAllTasksButtonProps {
  label?: string;
  size?: "large" | "regular";
}

export function PreparationAddAllTasksButton({
  label = "모든 할 일 추가",
  size = "regular",
}: PreparationAddAllTasksButtonProps) {
  return (
    <button
      aria-label={`${label} (준비 중)`}
      className={`preparation-task-list__add-all preparation-task-list__add-all--${size}`}
      disabled
      type="button"
    >
      {label}
    </button>
  );
}
