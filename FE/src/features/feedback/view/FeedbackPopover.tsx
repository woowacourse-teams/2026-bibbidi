import type { RefObject, SubmitEvent } from "react";

import { FeedbackSentiment, MAX_FEEDBACK_LENGTH } from "../useFeedbackForm";

interface FeedbackPopoverProps {
  canSubmit: boolean;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  content: string;
  onClose: () => void;
  onContentChange: (content: string) => void;
  onSentimentChange: (sentiment: FeedbackSentiment) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  sentiment: FeedbackSentiment | null;
}

function ThumbIcon({ direction }: { direction: "down" | "up" }) {
  return (
    <svg
      aria-hidden="true"
      className={
        direction === "down" ? "feedback-popover__thumb--down" : undefined
      }
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7.5 10.5 11 4.75c.4-.65 1.5-.35 1.5.45v4.3h4.8c1.1 0 1.9 1.05 1.6 2.1l-1.55 5.25A1.75 1.75 0 0 1 15.68 18H7.5m0-7.5V18H4.75v-7.5H7.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function FeedbackPopover({
  canSubmit,
  closeButtonRef,
  content,
  onClose,
  onContentChange,
  onSentimentChange,
  onSubmit,
  sentiment,
}: FeedbackPopoverProps) {
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
        <fieldset className="feedback-popover__rating">
          <legend className="feedback-popover__sr-only">만족도</legend>
          <button
            aria-pressed={sentiment === "good"}
            className="feedback-popover__rating-button"
            onClick={() => onSentimentChange("good")}
            type="button"
          >
            <ThumbIcon direction="up" />
            좋았어요
          </button>
          <button
            aria-pressed={sentiment === "bad"}
            className="feedback-popover__rating-button"
            onClick={() => onSentimentChange("bad")}
            type="button"
          >
            <ThumbIcon direction="down" />
            아쉬워요
          </button>
        </fieldset>

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
