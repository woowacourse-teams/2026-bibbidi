import { useRef } from "react";
import { Button } from "../../../components/button";
import { IconButton } from "../../../components/icon-button";
import { CloseIcon } from "../../../components/icons/ActionIcons";
import { TextArea } from "../../../components/text-area";
import { FeedbackRatingField } from "../../feedback/view/FeedbackRatingField";
import { MAX_FEEDBACK_LENGTH } from "../../feedback/model/feedback";
import { useAiChatFeedback } from "../hooks/useAiChatFeedback";
import "../../feedback/FeedbackFeature.css";
import "./AiChatFeedback.css";

export function AiChatFeedback({
  audienceKey,
  onDismiss,
  onInputFocus,
  onInputBlur,
}: {
  audienceKey: string;
  onDismiss: () => void;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const {
    status,
    dismiss,
    content,
    errorMessage,
    isSubmitting,
    sentiment,
    setContent,
    setSentiment,
    submit,
  } = useAiChatFeedback(audienceKey, () => {
    if (cardRef.current?.contains(document.activeElement)) onDismiss();
  });
  if (status === "hidden") return null;
  if (status === "submitted")
    return (
      <p className="ai-chat-feedback__thanks" role="status">
        의견 감사해요. 더 도움이 되는 대화를 준비할게요.
      </p>
    );
  return (
    <section
      ref={cardRef}
      className="ai-chat-feedback"
      aria-label="AI 대화 피드백"
    >
      <div className="ai-chat-feedback__header">
        <h3>이번 대화가 준비에 도움이 됐나요?</h3>
        <IconButton
          aria-label="대화 피드백 닫기"
          icon={<CloseIcon />}
          iconSize={16}
          disabled={isSubmitting}
          onClick={() => {
            dismiss();
            onDismiss();
          }}
        />
      </div>
      <form
        className="ai-chat-feedback__form"
        aria-busy={isSubmitting}
        onSubmit={submit}
      >
        <FeedbackRatingField
          size="medium"
          disabled={isSubmitting}
          onChange={setSentiment}
          value={sentiment}
          positiveLabel="도움됐어요"
          negativeLabel="아쉬웠어요"
        />
        {sentiment && (
          <>
            <TextArea
              label="어떤 점이 그랬나요? (선택)"
              placeholder="좋았거나 아쉬웠던 점을 알려주세요"
              onFocus={onInputFocus}
              onBlur={onInputBlur}
              rows={3}
              maxLength={MAX_FEEDBACK_LENGTH}
              disabled={isSubmitting}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <Button
              type="submit"
              size="small"
              display="block"
              disabled={sentiment === null}
              loading={isSubmitting}
            >
              피드백 보내기
            </Button>
          </>
        )}
        {errorMessage && (
          <p className="feedback-form__error" role="alert">
            {errorMessage}
          </p>
        )}
      </form>
    </section>
  );
}
