import { useId } from "react";
import { createPortal } from "react-dom";
import { useBottomSheetDismiss } from "../../../shared/bottom-sheet/useBottomSheetDismiss";
import { PreparationStepDetailViewModel } from "../view-model/createPreparationRoadmapViewModel";
import {
  PreparationAddAllTasksButton,
  PreparationTaskList,
} from "./PreparationTaskList";
import "./PreparationStepBottomSheet.css";

interface PreparationStepBottomSheetProps {
  additionErrorMessage: string | null;
  addingCatalogItemIds: readonly string[];
  canAddTasks: boolean;
  detail: PreparationStepDetailViewModel;
  onAddAllTasks: () => void;
  onClose: () => void;
  onTaskAdd: (catalogItemId: string) => void;
}

export function PreparationStepBottomSheet({
  additionErrorMessage,
  addingCatalogItemIds,
  canAddTasks,
  detail,
  onAddAllTasks,
  onClose,
  onTaskAdd,
}: PreparationStepBottomSheetProps) {
  const titleId = useId();
  const {
    dialogRef,
    finishDrag,
    handleDragKeyDown,
    handleDragMove,
    handleDragStart,
    handleRef,
    handleTransitionEnd,
    isClosing,
    isDragging,
    requestDismiss,
    rootStyle,
  } = useBottomSheetDismiss({ onDismiss: onClose });

  return createPortal(
    <div
      className={`preparation-step-bottom-sheet bottom-sheet-dismiss${
        isDragging ? " bottom-sheet-dismiss--dragging" : ""
      }${isClosing ? " bottom-sheet-dismiss--closing" : ""}`}
      style={rootStyle}
    >
      <button
        aria-label="단계 상세 닫기"
        className="preparation-step-bottom-sheet__scrim bottom-sheet-dismiss__scrim"
        onClick={requestDismiss}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="preparation-step-bottom-sheet__dialog bottom-sheet-dismiss__dialog"
        id="preparation-step-detail"
        onTransitionEnd={handleTransitionEnd}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label="아래로 밀어 단계 상세 닫기"
          className="preparation-step-bottom-sheet__handle-area bottom-sheet-dismiss__handle-area"
          onKeyDown={handleDragKeyDown}
          onPointerCancel={finishDrag}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={finishDrag}
          ref={handleRef}
          type="button"
        >
          <span
            aria-hidden="true"
            className="preparation-step-bottom-sheet__handle bottom-sheet-dismiss__handle"
          />
        </button>
        <header className="preparation-step-bottom-sheet__header">
          <div className="preparation-step-bottom-sheet__title-group">
            <h2 id={titleId}>{detail.title}</h2>
            {detail.description ? <p>{detail.description}</p> : null}
          </div>
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
              addingCatalogItemIds={addingCatalogItemIds}
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
              canAddTasks={canAddTasks}
              isScrollable
              onTaskAdd={onTaskAdd}
              tasks={detail.detailTasks}
              variant="available"
            />
            {detail.detailTasks.length > 0 ? (
              <footer className="preparation-step-bottom-sheet__footer">
                {additionErrorMessage ? (
                  <p className="preparation-task-list__error" role="alert">
                    {additionErrorMessage}
                  </p>
                ) : null}
                <PreparationAddAllTasksButton
                  isDisabled={!canAddTasks || addingCatalogItemIds.length > 0}
                  isLoading={addingCatalogItemIds.length > 0}
                  label="남은 할 일 모두 추가"
                  onClick={onAddAllTasks}
                />
              </footer>
            ) : null}
          </section>
        </div>
      </section>
    </div>,
    document.body,
  );
}
