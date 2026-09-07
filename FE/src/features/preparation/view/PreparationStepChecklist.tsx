import { PreparationStepTaskViewModel } from "../view-model/createPreparationRoadmapViewModel";
import "./PreparationStepChecklist.css";

interface PreparationStepChecklistProps {
  tasks: PreparationStepTaskViewModel[];
}

export function PreparationStepChecklist({
  tasks,
}: PreparationStepChecklistProps) {
  return (
    <section
      aria-label="이 단계의 체크리스트"
      aria-live="polite"
      className={`preparation-step-checklist${tasks.length === 0 ? " preparation-step-checklist--empty" : ""}`}
    >
      <header className="preparation-step-checklist__header">
        <h2>이 단계의 체크리스트</h2>
        <span className="preparation-step-checklist__count">
          {tasks.length}개
        </span>
      </header>
      {tasks.length > 0 ? (
        <ul
          aria-label="이 단계에 추가한 할 일"
          className="preparation-step-checklist__list"
        >
          {tasks.map((task) => (
            <li className="preparation-step-checklist__item" key={task.id}>
              <span
                aria-hidden="true"
                className="preparation-step-checklist__marker"
              />
              <span>{task.title}</span>
              {task.isEssential ? (
                <span className="preparation-task-essential-badge">필수</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="preparation-step-checklist__empty">
          <span
            className="preparation-step-checklist__empty-icon"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="5" y="4" width="14" height="17" rx="2" />
              <path d="M9 4V2h6v2M8 10l1 1 2-2M13 10h3M8 16l1 1 2-2M13 16h3" />
            </svg>
          </span>
          <h3>이 단계에 추가한 할 일이 없어요.</h3>
          <p>아래 준비할 일에서 필요한 항목을 확인해 보세요.</p>
        </div>
      )}
    </section>
  );
}
