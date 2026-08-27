import { UnscheduledTaskViewModel } from "../view-model/createUnscheduledTaskViewModel";
import "./UnscheduledTask.css";

interface UnscheduledTaskProps {
  viewModel: UnscheduledTaskViewModel;
}

function CalendarPlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="unscheduled-task-card__calendar-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="M7 3v3M17 3v3M4 9h16" />
      <rect height="16" rx="2" width="16" x="4" y="5" />
      <path d="M15 13v6M12 16h6" />
    </svg>
  );
}

export function UnscheduledTask({ viewModel }: UnscheduledTaskProps) {
  return (
    <section
      aria-labelledby="unscheduled-task-title"
      className="unscheduled-task"
    >
      <header className="unscheduled-task__header">
        <h2 id="unscheduled-task-title">{viewModel.title}</h2>
        <span className="unscheduled-task__count">{viewModel.countLabel}</span>
      </header>

      <div className="unscheduled-task__scroll-area">
        <ul className="unscheduled-task__list">
          {viewModel.items.map((item) => (
            <li className="unscheduled-task-card" key={item.id}>
              <div className="unscheduled-task-card__top">
                <span className="unscheduled-task-card__category">
                  {item.categoryLabel}
                </span>
                <span className="unscheduled-task-card__status">
                  <span
                    aria-hidden="true"
                    className="unscheduled-task-card__status-dot"
                  />
                  {item.statusLabel}
                </span>
              </div>
              <h3 className="unscheduled-task-card__title">{item.title}</h3>
              <button
                className="unscheduled-task-card__add-schedule"
                disabled
                type="button"
              >
                <CalendarPlusIcon />
                {viewModel.addScheduleLabel}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
