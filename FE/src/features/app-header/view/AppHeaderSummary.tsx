import { AppHeaderSummaryViewModel } from "../view-model/createAppHeaderSummaryViewModel";
import "./AppHeaderSummary.css";

interface AppHeaderSummaryProps {
  viewModel: AppHeaderSummaryViewModel;
}

export function AppHeaderSummary({ viewModel }: AppHeaderSummaryProps) {
  return (
    <section aria-label="결혼 준비 현황" className="app-header-summary">
      <div
        aria-label={viewModel.mobileDDayLabel}
        className="app-header-summary__d-day"
      >
        <span aria-hidden="true" className="app-header-summary__d-day-desktop">
          <strong>{viewModel.dDayLabel}</strong>
          <span>· {viewModel.weddingDateLabel}</span>
        </span>
        <strong aria-hidden="true" className="app-header-summary__d-day-mobile">
          {viewModel.mobileDDayLabel}
        </strong>
      </div>

      {viewModel.progress ? (
        <>
          <span aria-hidden="true" className="app-header-summary__separator" />

          <div className="app-header-summary__progress">
            <svg
              aria-hidden="true"
              className="app-header-summary__progress-ring"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" pathLength="100" r="9" />
              <circle
                className="app-header-summary__progress-range"
                cx="12"
                cy="12"
                pathLength="100"
                r="9"
                strokeDasharray={`${viewModel.progress.percentage} ${100 - viewModel.progress.percentage}`}
              />
            </svg>
            <strong>{viewModel.progress.label}</strong>
            <span>{viewModel.progress.taskCountLabel}</span>
          </div>
        </>
      ) : null}
    </section>
  );
}
