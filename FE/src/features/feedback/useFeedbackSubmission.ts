import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import { analytics } from "../../infrastructure/analytics";
import { createFeedbackSubmitEvent } from "./analytics/feedbackAnalytics";
import { createFeedback } from "./api/createFeedback";
import type { FeedbackSentiment } from "./model/feedback";

interface UseFeedbackSubmissionOptions {
  source?: "service_layout" | "ai_chat";
  onSuccess: () => void;
}

export function useFeedbackSubmission({
  source = "service_layout",
  onSuccess,
}: UseFeedbackSubmissionOptions) {
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);
  const submissionInFlightRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      requestGenerationRef.current += 1;
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      submissionInFlightRef.current = false;
    };
  }, []);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!sentiment || submissionInFlightRef.current) {
      return;
    }

    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    submissionInFlightRef.current = true;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await createFeedback(
        {
          content:
            source === "ai_chat"
              ? `[AI 대화 피드백]${content.trim() ? `\n${content}` : ""}`
              : content.trim() === ""
                ? null
                : content,
          sentiment,
        },
        controller.signal,
      );

      if (
        !isMountedRef.current ||
        controller.signal.aborted ||
        requestGenerationRef.current !== requestGeneration
      ) {
        return;
      }

      setSentiment(null);
      setContent("");
      analytics.track(createFeedbackSubmitEvent(source));
      onSuccess();
    } catch {
      if (
        isMountedRef.current &&
        !controller.signal.aborted &&
        requestGenerationRef.current === requestGeneration
      ) {
        setErrorMessage("의견을 보내지 못했어요. 다시 시도해 주세요.");
      }
    } finally {
      if (requestGenerationRef.current === requestGeneration) {
        requestControllerRef.current = null;
        submissionInFlightRef.current = false;

        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    }
  };

  return {
    clearError: () => setErrorMessage(null),
    canSubmit: sentiment !== null && !isSubmitting,
    content,
    errorMessage,
    isSubmitting,
    sentiment,
    setContent,
    setSentiment,
    submit,
  };
}
