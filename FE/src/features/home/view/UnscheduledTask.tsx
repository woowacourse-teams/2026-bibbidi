import { UnscheduledTaskViewModel } from "../view-model/createUnscheduledTaskViewModel";
import "./UnscheduledTask.css";

interface UnscheduledTaskProps {
  viewModel: UnscheduledTaskViewModel;
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
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
