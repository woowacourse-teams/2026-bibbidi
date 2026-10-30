import { TextArea } from "../../../components/text-area";
import { MAX_FEEDBACK_LENGTH } from "../model/feedback";
import { FeedbackRatingField } from "./FeedbackRatingField";
import type { FeedbackFormViewProps } from "./feedbackFormView";

export function FeedbackFormFields({
  content,
  errorMessage,
  isSubmitting,
  onContentChange,
  onSentimentChange,
  sentiment,
}: Pick<
  FeedbackFormViewProps,
  | "content"
  | "errorMessage"
  | "isSubmitting"
  | "onContentChange"
  | "onSentimentChange"
  | "sentiment"
>) {
  return (
    <div className="feedback-form__fields">
      <FeedbackRatingField
        disabled={isSubmitting}
        onChange={onSentimentChange}
        value={sentiment}
      />
      <TextArea
        label="의견을 들려주세요 (선택)"
        disabled={isSubmitting}
        maxLength={MAX_FEEDBACK_LENGTH}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="조금 더 자세히 알려주실래요? (선택)"
        value={content}
        rows={4}
      />
      {errorMessage && (
        <p className="feedback-form__error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
