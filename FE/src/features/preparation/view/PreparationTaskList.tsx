import { PreparationStepTaskViewModel } from "../view-model/createPreparationRoadmapViewModel";
import "./PreparationTaskList.css";

type PreparationTaskListDensity = "compact" | "regular";
type PreparationTaskListVariant = "available" | "checklist";

interface PreparationTaskListProps {
  addingCatalogItemIds?: readonly string[];
  canAddTasks?: boolean;
  density?: PreparationTaskListDensity;
  isScrollable?: boolean;
  onTaskAdd?: (catalogItemId: string) => void;
  tasks: PreparationStepTaskViewModel[];
  variant: PreparationTaskListVariant;
}

function PreparationTaskEmptyState({
  density,
  variant,
}: Pick<PreparationTaskListProps, "density" | "variant">) {
  const message =
    variant === "available"
      ? {
          description: "이 단계의 모든 할 일을 체크리스트에 추가했어요.",
          title: "추가할 수 있는 할 일이 없어요.",
        }
      : {
          description: "아래 준비할 일에서 필요한 항목을 확인해 보세요.",
          title: "이 단계에 추가한 할 일이 없어요.",
        };

  return (
    <div
      className={`preparation-task-list__empty-state preparation-task-list__empty-state--${density}`}
    >
      <span aria-hidden="true" className="preparation-task-list__empty-icon">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V2h6v2M8 10l1 1 2-2M13 10h3M8 16l1 1 2-2M13 16h3" />
        </svg>
      </span>
      <h3>{message.title}</h3>
      <p>{message.description}</p>
    </div>
  );
}

export function PreparationTaskList({
  addingCatalogItemIds = [],
  canAddTasks = false,
  density = "regular",
  isScrollable = false,
  onTaskAdd,
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
                  aria-label={
                    addingCatalogItemIds.includes(task.id)
                      ? `${task.title} 추가 중`
                      : `${task.title} 추가${canAddTasks ? "" : " (준비 중)"}`
                  }
                  className="preparation-task-list__add"
                  disabled={!canAddTasks || addingCatalogItemIds.length > 0}
                  onClick={() => onTaskAdd?.(task.id)}
                  type="button"
                >
                  {addingCatalogItemIds.includes(task.id) ? (
                    "추가 중..."
                  ) : (
                    <>
                      <span aria-hidden="true">+ </span>추가
                    </>
                  )}
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
  isDisabled?: boolean;
  isLoading?: boolean;
  label?: string;
  onClick?: () => void;
  size?: "large" | "regular";
}

export function PreparationAddAllTasksButton({
  isDisabled = true,
  isLoading = false,
  label = "모든 할 일 추가",
  onClick,
  size = "regular",
}: PreparationAddAllTasksButtonProps) {
  return (
    <button
      aria-label={`${label}${isLoading ? " 중" : isDisabled ? " (준비 중)" : ""}`}
      className={`preparation-task-list__add-all preparation-task-list__add-all--${size}`}
      disabled={isDisabled}
      onClick={onClick}
      type="button"
    >
      {isLoading ? "추가 중..." : label}
    </button>
  );
}
