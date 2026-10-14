import { PersonalRoadmapGroupViewModel } from "../view-model/createPersonalRoadmapViewModel";

export function PersonalRoadmapCard({
  group,
  onTaskSelect,
  onTaskComplete,
  isChangingStatus,
}: {
  group: PersonalRoadmapGroupViewModel;
  onTaskSelect: (taskId: string) => void;
  onTaskComplete: (taskId: string, checked: boolean) => void;
  isChangingStatus: boolean;
}) {
  return (
    <article
      className={`personal-roadmap__card${group.isCurrent ? " personal-roadmap__card--current" : ""}`}
      aria-labelledby={`personal-roadmap-group-${group.id}`}
    >
      <header className="personal-roadmap__card-header">
        <span className="personal-roadmap__number">{group.numberLabel}</span>
        <h3 id={`personal-roadmap-group-${group.id}`}>{group.title}</h3>
        <p>
          내 할 일 {group.totalCount}개 · 완료 {group.completedCount}개
        </p>
      </header>
      <ul
        className="personal-roadmap__tasks"
        aria-label={`${group.title}의 할 일`}
        // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 카드 안의 긴 할 일 목록을 키보드로 스크롤한다.
        tabIndex={0}
      >
        {group.tasks.map((task) => (
          <li className="personal-roadmap__task" key={task.id}>
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
              <span className="personal-roadmap__task-title">{task.title}</span>
              <span className="personal-roadmap__task-meta">
                {task.statusLabel} · {task.schedule}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}
