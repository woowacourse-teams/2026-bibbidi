import { RefObject } from "react";

import { AppHeaderProgressViewModel } from "../view-model/createAppHeaderSummaryViewModel";
import { usePreparationProgressPopover } from "./usePreparationProgressPopover";
import "./PreparationProgressPopover.css";

interface PreparationProgressPopoverProps {
  id: string;
  onClose: () => void;
  progress: AppHeaderProgressViewModel;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

export function PreparationProgressPopover({
  id,
  onClose,
  progress,
  triggerRef,
}: PreparationProgressPopoverProps) {
  const { closeAndRestoreFocus, closeRef, dialogRef, style } =
    usePreparationProgressPopover(onClose, triggerRef);

  return (
    <div
      aria-labelledby={`${id}-title`}
      className="preparation-progress-popover"
      id={id}
      ref={dialogRef}
      role="dialog"
      style={style}
    >
      <div className="preparation-progress-popover__heading">
        <h2 id={`${id}-title`}>카테고리별 완료율</h2>
        <button
          aria-label="완료율 팝오버 닫기"
          onClick={closeAndRestoreFocus}
          ref={closeRef}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <p>{progress.summaryLabel}</p>
      <div
        aria-label="카테고리별 준비 현황"
        className="preparation-progress-popover__list"
        role="region"
        // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 긴 카테고리 목록을 키보드로 스크롤할 수 있도록 포커스를 허용한다.
        tabIndex={0}
      >
        <ul>
          {progress.categories.map((category) => (
            <li key={category.id}>
              <span
                className="preparation-progress-popover__category"
                title={category.title}
              >
                {category.title}
              </span>
              <span
                aria-label={`${category.title} 완료율`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={category.percentage}
                className="preparation-progress-popover__track"
                role="progressbar"
              >
                <span style={{ width: `${category.percentage}%` }} />
              </span>
              <strong>{category.percentage}%</strong>
              <span className="preparation-progress-popover__count">
                {category.taskCountLabel}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
