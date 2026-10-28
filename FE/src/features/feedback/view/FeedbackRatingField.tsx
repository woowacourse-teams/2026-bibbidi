import { Button, type ButtonSize } from "../../../components/button";
import type { FeedbackSentiment } from "../model/feedback";

interface FeedbackRatingFieldProps {
  disabled: boolean;
  onChange: (sentiment: FeedbackSentiment) => void;
  value: FeedbackSentiment | null;
  positiveLabel?: string;
  negativeLabel?: string;
  size?: ButtonSize;
}

function ThumbIcon({ direction }: { direction: "down" | "up" }) {
  return (
    <svg
      aria-hidden="true"
      className={
        direction === "down"
          ? "feedback-rating__icon feedback-rating__icon--down"
          : "feedback-rating__icon"
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
  positiveLabel = "좋았어요",
  negativeLabel = "아쉬워요",
  size = "large",
}: FeedbackRatingFieldProps) {
  return (
    <fieldset className="feedback-rating">
      <legend className="feedback-feature__sr-only">만족도</legend>
      <Button
        aria-pressed={value === "good"}
        display="block"
        size={size}
        variant="weak"
        color={value === "good" ? "primary" : "dark"}
        disabled={disabled}
        onClick={() => onChange("good")}
        type="button"
      >
        <ThumbIcon direction="up" />
        {positiveLabel}
      </Button>
      <Button
        aria-pressed={value === "bad"}
        display="block"
        size={size}
        variant="weak"
        color={value === "bad" ? "primary" : "dark"}
        disabled={disabled}
        onClick={() => onChange("bad")}
        type="button"
      >
        <ThumbIcon direction="down" />
        {negativeLabel}
      </Button>
    </fieldset>
  );
}
