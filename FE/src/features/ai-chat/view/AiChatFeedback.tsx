import { useRef, useState } from "react";
import { Button } from "../../../components/button";
import { IconButton } from "../../../components/icon-button";
import { CloseIcon } from "../../../components/icons/ActionIcons";
import { TextArea } from "../../../components/text-area";
import { FeedbackRatingField } from "../../feedback/view/FeedbackRatingField";
import { MAX_FEEDBACK_LENGTH } from "../../feedback/model/feedback";
import { useFeedbackSubmission } from "../../feedback/useFeedbackSubmission";
import "../../feedback/FeedbackFeature.css";
import "./AiChatFeedback.css";

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

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
  const storageKey = `bibbidi:ai-chat-feedback:${audienceKey}`;
  const [hidden, setHidden] = useState(() => {
    try {
      const nextPromptAt = Number(localStorage.getItem(storageKey));
      return Number.isFinite(nextPromptAt) && nextPromptAt > Date.now();
    } catch {
      return false;
    }
  });
  const [submitted, setSubmitted] = useState(false);
  const snooze = () => {
    try {
      localStorage.setItem(storageKey, String(Date.now() + COOLDOWN_MS));
    } catch {
      /* Keep the session dismissal when browser storage is unavailable. */
    }
  };
  const {
    canSubmit,
    content,
    errorMessage,
    isSubmitting,
    sentiment,
    setContent,
    setSentiment,
    submit,
  } = useFeedbackSubmission({
    source: "ai_chat",
    onSuccess: () => {
      snooze();
      if (cardRef.current?.contains(document.activeElement)) onDismiss();
      setSubmitted(true);
    },
  });
  if (hidden) return null;
  if (submitted)
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
            snooze();
            setHidden(true);
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
              disabled={!canSubmit}
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
