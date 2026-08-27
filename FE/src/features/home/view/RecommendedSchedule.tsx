import { RecommendedScheduleViewModel } from "../view-model/createRecommendedScheduleViewModel";
import "./RecommendedSchedule.css";

interface RecommendedScheduleProps {
  viewModel: RecommendedScheduleViewModel;
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="recommended-schedule__chevron"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="recommended-schedule-card__plus"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function RecommendedSchedule({ viewModel }: RecommendedScheduleProps) {
  return (
    <section
      aria-labelledby="recommended-schedule-title"
      className="recommended-schedule"
    >
      <header className="recommended-schedule__header">
        <h2 id="recommended-schedule-title">{viewModel.title}</h2>
        <button
          className="recommended-schedule__catalog-action"
          disabled={viewModel.isCatalogActionDisabled}
          type="button"
        >
          {viewModel.catalogActionLabel}
          <ChevronRightIcon />
        </button>
      </header>

      <ul className="recommended-schedule__list">
        {viewModel.items.map((item) => (
          <li className="recommended-schedule-card" key={item.id}>
            <div className="recommended-schedule-card__top">
              <span>{item.categoryLabel}</span>
              <span>{item.recommendedTimingLabel}</span>
            </div>

            <div className="recommended-schedule-card__body">
              <h3>{item.title}</h3>
              <p>{item.reason}</p>
            </div>

            <button
              className="recommended-schedule-card__add-task"
              disabled={viewModel.isAddTaskActionDisabled}
              type="button"
            >
              <PlusIcon />
              {viewModel.addTaskLabel}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
