import { MAX_FEEDBACK_LENGTH } from "../useFeedbackForm";
import type { FeedbackFormViewProps } from "./feedbackFormView";
import { FeedbackRatingField } from "./FeedbackRatingField";

export function FeedbackPopover({
  canSubmit,
  closeButtonRef,
  content,
  onClose,
  onContentChange,
  onSentimentChange,
  onSubmit,
  sentiment,
}: FeedbackFormViewProps) {
  return (
    <section
      aria-label="서비스 피드백"
      aria-modal="false"
      className="feedback-popover"
      role="dialog"
    >
      <header className="feedback-popover__header">
        <h2>비비디, 어떠셨나요?</h2>
        <button
          aria-label="피드백 창 닫기"
          className="feedback-popover__close"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <form onSubmit={onSubmit}>
        <FeedbackRatingField onChange={onSentimentChange} value={sentiment} />

        <div className="feedback-popover__field">
          <div className="feedback-popover__label-row">
            <label htmlFor="feedback-content">의견을 들려주세요</label>
            <span>선택</span>
          </div>
          <textarea
            id="feedback-content"
            maxLength={MAX_FEEDBACK_LENGTH}
            onChange={(event) => onContentChange(event.target.value)}
            placeholder={
              "어떤 점이 좋았거나 불편했나요?\n자유롭게 작성해 주세요."
            }
            value={content}
          />
          <span className="feedback-popover__count">
            {content.length} / {MAX_FEEDBACK_LENGTH}
          </span>
        </div>

        <button
          className="feedback-popover__submit"
          disabled={!canSubmit}
          type="submit"
        >
          의견 보내기
        </button>
      </form>
    </section>
  );
}
