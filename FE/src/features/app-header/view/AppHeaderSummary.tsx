import { useRef } from "react";

import { AppHeaderSummaryViewModel } from "../view-model/createAppHeaderSummaryViewModel";
import { WeddingDatePopover } from "./WeddingDatePopover";
import { PreparationProgress } from "./PreparationProgress";
import { Button } from "../../../components/button";
import { Accordion } from "../../../components/accordion";
import "./AppHeaderSummary.css";

interface AppHeaderSummaryProps {
  isPopoverOpen: boolean;
  isProgressExpanded: boolean;
  isSaving: boolean;
  onClosePopover: () => void;
  onOpenPopover: () => void;
  onRetryWeddingDate: () => void;
  onSaveWeddingDate: (date: string) => void;
  onProgressExpandedChange: (expanded: boolean) => void;
  saveError: string | null;
  viewModel: AppHeaderSummaryViewModel;
  weddingDate: string | null;
}

export function AppHeaderSummary({
  isPopoverOpen,
  isProgressExpanded,
  isSaving,
  onClosePopover,
  onOpenPopover,
  onRetryWeddingDate,
  onSaveWeddingDate,
  onProgressExpandedChange,
  saveError,
  viewModel,
  weddingDate,
}: AppHeaderSummaryProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isWeddingDateUnset =
    viewModel.weddingDateStatus === "loaded" && weddingDate === null;
  const dateDisplay = (
    <span aria-hidden="true" className="app-header-summary__date-value">
      <strong>{viewModel.dDayLabel}</strong>
      <span>· {viewModel.weddingDateLabel}</span>
    </span>
  );

  return (
    <section aria-label="결혼 준비 현황" className="app-header-summary">
      <div className="app-header-summary__wedding-date">
        <span className="app-header-summary__label">결혼 예정일</span>
        {viewModel.weddingDateStatus === "loaded" ? (
          <Button
            aria-expanded={isPopoverOpen}
            aria-haspopup="dialog"
            aria-label={`${viewModel.dDayLabel}, ${viewModel.weddingDateLabel}. 결혼 예정일 설정`}
            onClick={onOpenPopover}
            ref={triggerRef}
            type="button"
            color={isWeddingDateUnset ? "primary" : "dark"}
            variant="weak"
            size="medium"
            display="block"
          >
            {dateDisplay}
          </Button>
        ) : (
          <div
            aria-label={viewModel.weddingDateLabel}
            className="app-header-summary__d-day"
            role="status"
          >
            {dateDisplay}
          </div>
        )}
        {viewModel.weddingDateStatus === "error" ? (
          <Button
            aria-label="결혼 예정일 조회 다시 시도"
            onClick={onRetryWeddingDate}
            type="button"
            color="dark"
            variant="weak"
            size="medium"
          >
            다시 시도
          </Button>
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
        <Accordion
          className="app-header-summary__progress"
          disabled={isSaving}
          headingLevel={3}
          highlight={false}
          onValueChange={(values) =>
            onProgressExpandedChange(values.includes("progress"))
          }
          size="medium"
          value={isProgressExpanded ? ["progress"] : []}
        >
          <Accordion.Item
            description={viewModel.progress.taskCountLabel}
            prefix={
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
            }
            title={`준비 완료율 · ${viewModel.progress.label}`}
            value="progress"
          >
            <PreparationProgress categories={viewModel.progress.categories} />
          </Accordion.Item>
        </Accordion>
      ) : null}
    </section>
  );
}
