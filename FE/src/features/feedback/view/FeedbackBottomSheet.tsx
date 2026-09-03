import { useEffect } from "react";

import { MAX_FEEDBACK_LENGTH } from "../useFeedbackForm";
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
  closeButtonRef,
  content,
  onClose,
  onContentChange,
  onSentimentChange,
  onSubmit,
  sentiment,
}: FeedbackFormViewProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="feedback-bottom-sheet">
      <button
        aria-label="피드백 창 닫기"
        className="feedback-bottom-sheet__scrim"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby="feedback-bottom-sheet-title"
        aria-modal="true"
        className="feedback-bottom-sheet__content"
        role="dialog"
      >
        <div aria-hidden="true" className="feedback-bottom-sheet__handle-area">
          <span className="feedback-bottom-sheet__handle" />
        </div>

        <header className="feedback-bottom-sheet__header">
          <h2 id="feedback-bottom-sheet-title">비비디, 어떠셨나요?</h2>
          <button
            aria-label="피드백 창 닫기"
            className="feedback-bottom-sheet__close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form onSubmit={onSubmit}>
          <FeedbackRatingField onChange={onSentimentChange} value={sentiment} />

          <label className="feedback-bottom-sheet__field">
            <span className="feedback-feature__sr-only">
              의견을 들려주세요 (선택)
            </span>
            <MessageIcon />
            <textarea
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
            의견 보내기
          </button>
        </form>
      </section>
    </div>
  );
}
