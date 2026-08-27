import { UpcomingScheduleViewModel } from "../view-model/createUpcomingScheduleViewModel";
import "./UpcomingSchedule.css";

interface UpcomingScheduleProps {
  viewModel: UpcomingScheduleViewModel;
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="upcoming-schedule-card__clock"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.25 2" />
    </svg>
  );
}

export function UpcomingSchedule({ viewModel }: UpcomingScheduleProps) {
  return (
    <section
      aria-labelledby="upcoming-schedule-title"
      className="upcoming-schedule"
    >
      <header className="upcoming-schedule__header">
        <h2 id="upcoming-schedule-title">{viewModel.title}</h2>
        <span className="upcoming-schedule__count">{viewModel.countLabel}</span>
      </header>

      <ul className="upcoming-schedule__list">
        {viewModel.items.map((item) => (
          <li className="upcoming-schedule-card" key={item.id}>
            <div className="upcoming-schedule-card__top">
              <div className="upcoming-schedule-card__date-group">
                <span className="upcoming-schedule-card__relative-date">
                  {item.relativeDateLabel}
                </span>
                <time
                  className="upcoming-schedule-card__date"
                  dateTime={item.dateTime}
                >
                  {item.dateLabel}
                </time>
              </div>
              <span
                className={`upcoming-schedule-card__status upcoming-schedule-card__status--${item.status}`}
              >
                {item.statusLabel}
              </span>
            </div>

            <h3 className="upcoming-schedule-card__title">{item.title}</h3>

            <div className="upcoming-schedule-card__detail">
              <ClockIcon />
              <span>{item.detailLabel}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
