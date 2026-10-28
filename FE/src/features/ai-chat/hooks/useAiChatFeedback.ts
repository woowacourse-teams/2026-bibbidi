import { useState } from "react";
import { useFeedbackSubmission } from "../../feedback/useFeedbackSubmission";
import { AI_CHAT_FEEDBACK_COOLDOWN_MS } from "../model/aiChatFeedback";

export function useAiChatFeedback(
  audienceKey: string,
  onSubmitted: () => void,
) {
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
  function snooze() {
    try {
      localStorage.setItem(
        storageKey,
        String(Date.now() + AI_CHAT_FEEDBACK_COOLDOWN_MS),
      );
    } catch {
      /* Keep session state when browser storage is unavailable. */
    }
  }
  const submission = useFeedbackSubmission({
    source: "ai_chat",
    onSuccess: () => {
      snooze();
      onSubmitted();
      setSubmitted(true);
    },
  });
  return {
    ...submission,
    status: hidden
      ? ("hidden" as const)
      : submitted
        ? ("submitted" as const)
        : ("ready" as const),
    dismiss() {
      if (submission.isSubmitting) return;
      snooze();
      setHidden(true);
    },
  };
}
