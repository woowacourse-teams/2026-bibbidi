import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import { analytics } from "../../infrastructure/analytics";
import { createFeedbackSubmitEvent } from "./analytics/feedbackAnalytics";
import { createFeedback } from "./api/createFeedback";
import type { FeedbackSentiment } from "./model/feedback";

const SNACKBAR_DURATION_MS = 2_000;

interface UseFeedbackFormOptions {
  isMobile: boolean;
}

export function useFeedbackForm({ isMobile }: UseFeedbackFormOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null);
  const [content, setContent] = useState("");
  const [isSnackbarVisible, setIsSnackbarVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (!isOpen || isMobile) {
      return;
    }

    closeButtonRef.current?.focus();

    const closeAndRestoreFocus = () => {
      if (isSubmitting) {
        return;
      }

      setIsOpen(false);
      triggerButtonRef.current?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeAndRestoreFocus();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAndRestoreFocus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobile, isOpen, isSubmitting]);

  useEffect(() => {
    if (!isSnackbarVisible) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setIsSnackbarVisible(false),
      SNACKBAR_DURATION_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, [isSnackbarVisible]);

  const open = () => {
    setIsSnackbarVisible(false);
    setErrorMessage(null);
    setIsOpen(true);
  };

  const close = () => {
    if (isSubmitting) {
      return;
    }

    setIsOpen(false);
    triggerButtonRef.current?.focus();
  };

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
          content: content.trim() === "" ? null : content,
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

      setIsOpen(false);
      setSentiment(null);
      setContent("");
      setIsSnackbarVisible(true);
      triggerButtonRef.current?.focus();
      analytics.track(createFeedbackSubmitEvent());
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
    canSubmit: sentiment !== null && !isSubmitting,
    close,
    closeButtonRef,
    containerRef,
    content,
    errorMessage,
    isOpen,
    isSnackbarVisible,
    isSubmitting,
    open,
    sentiment,
    setContent,
    setSentiment,
    submit,
    triggerButtonRef,
  };
}
