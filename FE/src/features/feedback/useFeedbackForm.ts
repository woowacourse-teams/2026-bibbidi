import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import { createFeedback } from "./api/createFeedback";
import type { FeedbackSentiment } from "./model/feedback";

const SNACKBAR_DURATION_MS = 2_000;

export function useFeedbackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null);
  const [content, setContent] = useState("");
  const [isSnackbarVisible, setIsSnackbarVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen, isSubmitting]);

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

    if (!sentiment || isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await createFeedback({
        content: content.trim() === "" ? null : content,
        sentiment,
      });
      setIsOpen(false);
      setSentiment(null);
      setContent("");
      setIsSnackbarVisible(true);
      triggerButtonRef.current?.focus();
    } catch {
      setErrorMessage("의견을 보내지 못했어요. 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
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
