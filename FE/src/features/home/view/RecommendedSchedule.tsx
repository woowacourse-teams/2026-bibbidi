import { Link } from "react-router";

import { RecommendedScheduleViewModel } from "../view-model/createRecommendedScheduleViewModel";
import "./RecommendedSchedule.css";

interface RecommendedScheduleProps {
  compact?: boolean;
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
      className="recommended-schedule-item__plus"
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
  compact = false,
}: RecommendedScheduleProps) {
  return (
    <section
      aria-labelledby="recommended-schedule-title"
      className="recommended-schedule"
    >
      <header className="recommended-schedule__header">
        <h2 id="recommended-schedule-title">{viewModel.title}</h2>
        <Link
          className="recommended-schedule__catalog-action"
          to="/preparation"
        >
          로드맵 전체 보기
          <ChevronRightIcon />
        </Link>
      </header>

      {!compact && (
        <p className="recommended-schedule__description">
          아직 담지 않은 로드맵 항목 중 추가하면 좋은 준비예요.
        </p>
      )}
      <ul className="recommended-schedule__list">
        {viewModel.items.map((item) => (
          <li className="recommended-schedule-item" key={item.catalogItemId}>
            <div className="recommended-schedule-item__badges">
              <span className="recommended-schedule-item__category">
                {item.categoryLabel}
              </span>
              {!compact && (
                <span className="recommended-schedule-item__step">
                  {item.stepName}
                </span>
              )}
            </div>

            <div className="recommended-schedule-item__body">
              <h3>{item.title}</h3>
            </div>

            <button
              className="recommended-schedule-item__add-task"
              disabled={item.isAddActionDisabled}
              aria-busy={item.addActionLabel === "추가 중..."}
              onClick={() => onAddTask(item.catalogItemId)}
              type="button"
            >
              {item.addActionLabel === "내 할 일에 추가" && <PlusIcon />}
              {item.addActionLabel}
            </button>
            {item.additionErrorMessage && (
              <p className="recommended-schedule-item__error" role="alert">
                {item.additionErrorMessage}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
