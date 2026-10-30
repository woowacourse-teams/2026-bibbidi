import { useRef } from "react";

import { AppHeaderSummaryViewModel } from "../view-model/createAppHeaderSummaryViewModel";
import { WeddingDateDialog } from "./WeddingDateDialog";
import { PreparationProgress } from "./PreparationProgress";
import { Accordion } from "../../../components/accordion";
import { IconButton } from "../../../components/icon-button";
import { RetryIcon } from "../../../components/icons/ActionIcons";
import { ProgressRing } from "../../../components/progress-ring";
import { ListRow } from "../../../components/list-row";
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
  const { isWeddingDateUnset } = viewModel;
  const dateDisplay = (
    <ListRow.Texts
      top="결혼 예정일"
      bottom={
        viewModel.weddingDateStatus === "error" ? (
          <span className="app-header-summary__date-error-message">
            {viewModel.weddingDateDescription}
          </span>
        ) : (
          viewModel.weddingDateDescription
        )
      }
    />
  );

  return (
    <section aria-label="결혼 준비 현황" className="app-header-summary">
      <div className="app-header-summary__wedding-date">
        {viewModel.weddingDateStatus === "loaded" ? (
          <ListRow
            aria-expanded={isPopoverOpen}
            aria-haspopup="dialog"
            aria-label={viewModel.weddingDateAccessibleLabel}
            className={
              isWeddingDateUnset ? "app-header-summary__date--unset" : undefined
            }
            border="none"
            horizontalPadding="small"
            withArrow
            contents={dateDisplay}
            right={
              isWeddingDateUnset ? (
                <span
                  className="app-header-summary__date-action"
                  aria-hidden="true"
                >
                  {viewModel.weddingDateActionLabel}
                </span>
              ) : undefined
            }
            onClick={onOpenPopover}
            ref={triggerRef}
          />
        ) : (
          <ListRow
            aria-label={viewModel.weddingDateLabel}
            role="status"
            border="none"
            horizontalPadding="small"
            contents={dateDisplay}
            right={
              viewModel.weddingDateStatus === "error" ? (
                <IconButton
                  icon={<RetryIcon />}
                  iconSize={20}
                  aria-label="결혼 예정일 조회 다시 시도"
                  title="결혼 예정일 조회 다시 시도"
                  onClick={onRetryWeddingDate}
                />
              ) : undefined
            }
          />
        )}
        {isPopoverOpen && viewModel.weddingDateStatus === "loaded" ? (
          <WeddingDateDialog
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
            prefix={<ProgressRing value={viewModel.progress.percentage} />}
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
