import { PersonalRoadmapGroupViewModel } from "../view-model/createPersonalRoadmapViewModel";
import { PersonalRoadmapCardFrame } from "./PersonalRoadmapCardFrame";
import { AddedRoadmapTaskTitle } from "./AddedRoadmapTaskTitle";
import { useRoadmapTaskScroll } from "../hooks/useRoadmapTaskScroll";

export function PersonalRoadmapCard({
  group,
  onTaskSelect,
  onTaskComplete,
  isChangingStatus,
  revealTaskId,
  onRevealComplete,
}: {
  group: PersonalRoadmapGroupViewModel;
  onTaskSelect: (taskId: string) => void;
  onTaskComplete: (taskId: string, checked: boolean) => void;
  isChangingStatus: boolean;
  revealTaskId?: string;
  onRevealComplete?: () => void;
}) {
  const { ref: revealRef, isReady } = useRoadmapTaskScroll(
    group.tasks.some((task) => task.id === revealTaskId)
      ? revealTaskId
      : undefined,
  );
  return (
    <PersonalRoadmapCardFrame
      id={group.id}
      title={group.title}
      numberLabel={group.numberLabel}
      summary={`내 할 일 ${group.totalCount}개 · 완료 ${group.completedCount}개`}
      isCurrent={group.isCurrent}
    >
      {group.tasks.map((task) => (
        <li
          className="personal-roadmap__task"
          key={task.id}
          ref={task.id === revealTaskId ? revealRef : undefined}
        >
          <label className="personal-roadmap__checkbox-target">
            <input
              aria-label={`${task.title} 완료`}
              checked={task.isComplete}
              className="personal-roadmap__status"
              disabled={isChangingStatus}
              onChange={(event) =>
                onTaskComplete(task.id, event.target.checked)
              }
              type="checkbox"
            />
          </label>
          <button
            aria-label={`${task.title} ${task.statusLabel} ${task.schedule} 상세 보기`}
            className="personal-roadmap__task-detail"
            disabled={isChangingStatus}
            onClick={() => onTaskSelect(task.id)}
            type="button"
          >
            {task.id === revealTaskId && onRevealComplete ? (
              <AddedRoadmapTaskTitle
                title={task.title}
                isReady={isReady}
                onComplete={onRevealComplete}
              />
            ) : (
              <span className="personal-roadmap__task-title">{task.title}</span>
            )}
            <span className="personal-roadmap__task-meta">
              {task.statusLabel} · {task.schedule}
            </span>
          </button>
        </li>
      ))}
    </PersonalRoadmapCardFrame>
  );
}
