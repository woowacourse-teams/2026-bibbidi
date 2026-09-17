import { Link } from "react-router";

import { RecommendedScheduleViewModel } from "../view-model/createRecommendedScheduleViewModel";
import "./RecommendedSchedule.css";

interface RecommendedScheduleProps {
  onAddTask: (catalogItemId: number) => void;
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

export function RecommendedSchedule({
  onAddTask,
  viewModel,
}: RecommendedScheduleProps) {
  return (
    <section
      aria-labelledby="recommended-schedule-title"
      className="recommended-schedule"
    >
      <header className="recommended-schedule__header">
        <h2 id="recommended-schedule-title">{viewModel.title}</h2>
        <Link className="recommended-schedule__catalog-action" to="/">
          {viewModel.catalogActionLabel}
          <ChevronRightIcon />
        </Link>
      </header>

      <ul className="recommended-schedule__list">
        {viewModel.items.map((item) => (
          <li className="recommended-schedule-card" key={item.catalogItemId}>
            <div className="recommended-schedule-card__top">
              <span>{item.categoryLabel}</span>
            </div>

            <div className="recommended-schedule-card__body">
              <h3>{item.title}</h3>
              <p>{item.stepName}</p>
            </div>

            <button
              className="recommended-schedule-card__add-task"
              disabled={item.isAddActionDisabled}
              onClick={() => onAddTask(item.catalogItemId)}
              type="button"
            >
              <PlusIcon />
              {item.addActionLabel}
            </button>
            {item.additionErrorMessage && (
              <p className="recommended-schedule-card__error" role="alert">
                {item.additionErrorMessage}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
