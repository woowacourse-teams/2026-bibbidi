import { PreparationStepDetailViewModel } from "../view-model/createPreparationRoadmapViewModel";

interface PreparationStepDetailProps {
  detail: PreparationStepDetailViewModel;
}

export function PreparationStepDetail({ detail }: PreparationStepDetailProps) {
  return (
    <aside
      aria-label="이 단계에서 준비할 일"
      className="preparation-step-detail"
    >
      <div className="preparation-step-detail__panel">
        <header className="preparation-step-detail__header">
          <span className="preparation-step-detail__category">
            {detail.categoryLabel}
          </span>
          <h2>{detail.title}</h2>
          <p>{detail.description}</p>
          <span
            className={`preparation-step-detail__status preparation-step-detail__status--${detail.status}`}
          >
            {detail.statusLabel}
          </span>
        </header>

        <div aria-hidden="true" className="preparation-step-detail__divider" />

        <ul className="preparation-step-detail__tasks">
          {detail.tasks.map((task) => (
            <li key={task.id}>
              <span aria-hidden="true" />
              {task.title}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
