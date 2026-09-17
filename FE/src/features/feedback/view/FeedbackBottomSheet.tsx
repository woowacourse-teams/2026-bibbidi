import { useBottomSheetDismiss } from "../../../shared/bottom-sheet/useBottomSheetDismiss";
import { MAX_FEEDBACK_LENGTH } from "../model/feedback";
import type { FeedbackFormViewProps } from "./feedbackFormView";
import { FeedbackRatingField } from "./FeedbackRatingField";

function MessageIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 5.75h14v10.5H9.5L5 19v-13.25Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M8 9.5h8M8 12.5h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function FeedbackBottomSheet({
  canSubmit,
  content,
  errorMessage,
  isSubmitting,
  onClose,
  onContentChange,
  onSentimentChange,
  onSubmit,
  sentiment,
}: FeedbackFormViewProps) {
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
  } = useBottomSheetDismiss({
    canDismiss: !isSubmitting,
    onDismiss: onClose,
  });

  return (
    <div
      className={`feedback-bottom-sheet bottom-sheet-dismiss${
        isDragging ? " bottom-sheet-dismiss--dragging" : ""
      }${isClosing ? " bottom-sheet-dismiss--closing" : ""}`}
      style={rootStyle}
    >
      <button
        aria-label="피드백 창 닫기"
        className="feedback-bottom-sheet__scrim bottom-sheet-dismiss__scrim"
        disabled={isSubmitting}
        onClick={requestDismiss}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby="feedback-bottom-sheet-title"
        aria-modal="true"
        className="feedback-bottom-sheet__content bottom-sheet-dismiss__dialog"
        onTransitionEnd={handleTransitionEnd}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label="아래로 밀어 피드백 창 닫기"
          className="feedback-bottom-sheet__handle-area bottom-sheet-dismiss__handle-area"
          disabled={isSubmitting}
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
            className="feedback-bottom-sheet__handle bottom-sheet-dismiss__handle"
          />
        </button>

        <header className="feedback-bottom-sheet__header">
          <h2 id="feedback-bottom-sheet-title">비비디, 어떠셨나요?</h2>
        </header>

        <form aria-busy={isSubmitting} onSubmit={onSubmit}>
          <FeedbackRatingField
            disabled={isSubmitting}
            onChange={onSentimentChange}
            value={sentiment}
          />

          <label className="feedback-bottom-sheet__field">
            <span className="feedback-feature__sr-only">
              의견을 들려주세요 (선택)
            </span>
            <MessageIcon />
            <textarea
              disabled={isSubmitting}
              maxLength={MAX_FEEDBACK_LENGTH}
              onChange={(event) => onContentChange(event.target.value)}
              placeholder="조금 더 자세히 알려주실래요? (선택)"
              value={content}
            />
          </label>

          <button
            className="feedback-bottom-sheet__submit"
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting ? "보내는 중..." : "의견 보내기"}
          </button>
          {errorMessage ? (
            <p className="feedback-form__error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
