import { BottomSheet } from "../../../shared/bottom-sheet/BottomSheet";
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
  return (
    <BottomSheet
      canDismiss={!isSubmitting}
      className="feedback-bottom-sheet"
      closeLabel="피드백 창 닫기"
      onClose={onClose}
      title="비비디, 어떠셨나요?"
      titleId="feedback-bottom-sheet-title"
    >
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
    </BottomSheet>
  );
}
