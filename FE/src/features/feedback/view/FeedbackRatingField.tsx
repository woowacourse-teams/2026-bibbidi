import type { FeedbackSentiment } from "../model/feedback";

interface FeedbackRatingFieldProps {
  disabled: boolean;
  onChange: (sentiment: FeedbackSentiment) => void;
  value: FeedbackSentiment | null;
}

function ThumbIcon({ direction }: { direction: "down" | "up" }) {
  return (
    <svg
      aria-hidden="true"
      className={
        direction === "down" ? "feedback-rating__thumb--down" : undefined
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

export function FeedbackRatingField({
  disabled,
  onChange,
  value,
}: FeedbackRatingFieldProps) {
  return (
    <fieldset className="feedback-rating">
      <legend className="feedback-feature__sr-only">만족도</legend>
      <button
        aria-pressed={value === "good"}
        className="feedback-rating__button"
        disabled={disabled}
        onClick={() => onChange("good")}
        type="button"
      >
        <ThumbIcon direction="up" />
        좋았어요
      </button>
      <button
        aria-pressed={value === "bad"}
        className="feedback-rating__button"
        disabled={disabled}
        onClick={() => onChange("bad")}
        type="button"
      >
        <ThumbIcon direction="down" />
        아쉬워요
      </button>
    </fieldset>
  );
}
