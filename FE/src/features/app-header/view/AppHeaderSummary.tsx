import { useRef } from "react";

import { AppHeaderSummaryViewModel } from "../view-model/createAppHeaderSummaryViewModel";
import { WeddingDatePopover } from "./WeddingDatePopover";
import "./AppHeaderSummary.css";

interface AppHeaderSummaryProps {
  isPopoverOpen: boolean;
  isSaving: boolean;
  onClosePopover: () => void;
  onOpenPopover: () => void;
  onRetryWeddingDate: () => void;
  onSaveWeddingDate: (date: string) => void;
  saveError: string | null;
  viewModel: AppHeaderSummaryViewModel;
  weddingDate: string | null;
}

export function AppHeaderSummary({
  isPopoverOpen,
  isSaving,
  onClosePopover,
  onOpenPopover,
  onRetryWeddingDate,
  onSaveWeddingDate,
  saveError,
  viewModel,
  weddingDate,
}: AppHeaderSummaryProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dateDisplay = (
    <>
      <span aria-hidden="true" className="app-header-summary__d-day-desktop">
        <strong>{viewModel.dDayLabel}</strong>
        <span>· {viewModel.weddingDateLabel}</span>
      </span>
      <strong aria-hidden="true" className="app-header-summary__d-day-mobile">
        {viewModel.mobileDDayLabel}
      </strong>
    </>
  );

  return (
    <section aria-label="결혼 준비 현황" className="app-header-summary">
      <div className="app-header-summary__wedding-date">
        {viewModel.weddingDateStatus === "loaded" ? (
          <button
            aria-expanded={isPopoverOpen}
            aria-haspopup="dialog"
            aria-label={`${viewModel.dDayLabel}, ${viewModel.weddingDateLabel}. 결혼 예정일 설정`}
            className="app-header-summary__d-day app-header-summary__d-day-button"
            onClick={onOpenPopover}
            ref={triggerRef}
            type="button"
          >
            {dateDisplay}
          </button>
        ) : (
          <div
            aria-label={viewModel.mobileDDayLabel}
            className="app-header-summary__d-day"
            role="status"
          >
            {dateDisplay}
          </div>
        )}
        {viewModel.weddingDateStatus === "error" ? (
          <button
            aria-label="결혼 예정일 조회 다시 시도"
            className="app-header-summary__retry"
            onClick={onRetryWeddingDate}
            type="button"
          >
            다시 시도
          </button>
        ) : null}
        {isPopoverOpen && viewModel.weddingDateStatus === "loaded" ? (
          <WeddingDatePopover
            initialDate={weddingDate}
            isSaving={isSaving}
            onClose={onClosePopover}
            onSave={onSaveWeddingDate}
            returnFocusRef={triggerRef}
            saveError={saveError}
          />
        ) : null}
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
