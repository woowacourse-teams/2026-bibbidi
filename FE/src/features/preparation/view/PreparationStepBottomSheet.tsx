import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { PreparationStepDetailViewModel } from "../view-model/createPreparationRoadmapViewModel";
import {
  PreparationAddAllTasksButton,
  PreparationTaskList,
} from "./PreparationTaskList";
import { usePreparationBottomSheetModal } from "./usePreparationBottomSheetModal";
import "./PreparationStepBottomSheet.css";

interface PreparationStepBottomSheetProps {
  detail: PreparationStepDetailViewModel;
  onClose: () => void;
}

export function PreparationStepBottomSheet({
  detail,
  onClose,
}: PreparationStepBottomSheetProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  usePreparationBottomSheetModal({
    dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  return createPortal(
    <div className="preparation-step-bottom-sheet">
      <button
        aria-label="단계 상세 닫기"
        className="preparation-step-bottom-sheet__scrim"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="preparation-step-bottom-sheet__dialog"
        id="preparation-step-detail"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div
          aria-hidden="true"
          className="preparation-step-bottom-sheet__handle-area"
        >
          <span className="preparation-step-bottom-sheet__handle" />
        </div>
        <header className="preparation-step-bottom-sheet__header">
          <div className="preparation-step-bottom-sheet__title-group">
            <h2 id={titleId}>{detail.title}</h2>
            {detail.description ? <p>{detail.description}</p> : null}
          </div>
          <button
            aria-label="단계 상세 닫기"
            className="preparation-step-bottom-sheet__close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="preparation-step-bottom-sheet__content">
          <section className="preparation-step-bottom-sheet__section">
            <header className="preparation-step-bottom-sheet__section-header">
              <h3>이 단계의 체크리스트</h3>
              <span className="preparation-step-bottom-sheet__count">
                {detail.checklistTasks.length}개
              </span>
            </header>
            <PreparationTaskList
              isScrollable
              tasks={detail.checklistTasks}
              variant="checklist"
            />
          </section>
          <section className="preparation-step-bottom-sheet__section">
            <header className="preparation-step-bottom-sheet__section-header">
              <h3>추가할 수 있는 할 일</h3>
              <span className="preparation-step-bottom-sheet__count">
                {detail.detailTasks.length}개
              </span>
            </header>
            <PreparationTaskList
              isScrollable
              tasks={detail.detailTasks}
              variant="available"
            />
            <footer className="preparation-step-bottom-sheet__footer">
              <PreparationAddAllTasksButton label="남은 할 일 모두 추가" />
            </footer>
          </section>
        </div>
      </section>
    </div>,
    document.body,
  );
}
