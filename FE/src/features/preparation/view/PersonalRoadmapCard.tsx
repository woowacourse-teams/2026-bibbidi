import { PersonalRoadmapGroupViewModel } from "../view-model/createPersonalRoadmapViewModel";

export function PersonalRoadmapCard({
  group,
}: {
  group: PersonalRoadmapGroupViewModel;
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
            <span
              aria-hidden="true"
              className={`personal-roadmap__status${task.isComplete ? " personal-roadmap__status--complete" : ""}`}
            >
              {task.isComplete ? (
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="m3 8 3 3 7-7" />
                </svg>
              ) : null}
            </span>
            <div>
              <p className="personal-roadmap__task-title">{task.title}</p>
              <p className="personal-roadmap__task-meta">
                {task.statusLabel} · {task.schedule}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
