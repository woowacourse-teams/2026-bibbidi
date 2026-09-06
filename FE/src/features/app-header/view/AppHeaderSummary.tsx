import { AppHeaderSummaryViewModel } from "../view-model/createAppHeaderSummaryViewModel";
import "./AppHeaderSummary.css";

interface AppHeaderSummaryProps {
  viewModel: AppHeaderSummaryViewModel;
}

export function AppHeaderSummary({ viewModel }: AppHeaderSummaryProps) {
  return (
    <section aria-label="결혼 준비 현황" className="app-header-summary">
      <div className="app-header-summary__d-day">
        <strong>{viewModel.dDayLabel}</strong>
        <time dateTime={viewModel.weddingDate}>
          {viewModel.weddingDateLabel}
        </time>
      </div>

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
            strokeDasharray={`${viewModel.progressPercentage} ${100 - viewModel.progressPercentage}`}
          />
        </svg>
        <strong>{viewModel.progressLabel}</strong>
        <span>{viewModel.taskCountLabel}</span>
      </div>
    </section>
  );
}
