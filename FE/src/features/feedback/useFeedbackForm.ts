import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

export const MAX_FEEDBACK_LENGTH = 200;
const SNACKBAR_DURATION_MS = 2_000;

export type FeedbackSentiment = "bad" | "good";

export function useFeedbackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null);
  const [content, setContent] = useState("");
  const [isSnackbarVisible, setIsSnackbarVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    const closeAndRestoreFocus = () => {
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
  }, [isOpen]);

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
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    triggerButtonRef.current?.focus();
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!sentiment) {
      return;
    }

    setIsOpen(false);
    setSentiment(null);
    setContent("");
    setIsSnackbarVisible(true);
    triggerButtonRef.current?.focus();
  };

  return {
    canSubmit: sentiment !== null,
    close,
    closeButtonRef,
    containerRef,
    content,
    isOpen,
    isSnackbarVisible,
    open,
    sentiment,
    setContent,
    setSentiment,
    submit,
    triggerButtonRef,
  };
}
