import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  useExitSnapshot,
  useLayerPresence,
} from "../../shared/modal/useLayerPresence";
import { useIsMobileLayout } from "../../shared/responsive";
import { useFeedbackSubmission } from "./useFeedbackSubmission";
import { FeedbackBottomSheet } from "./view/FeedbackBottomSheet";
import { FeedbackDialog } from "./view/FeedbackDialog";
import { FeedbackSnackbar } from "./view/FeedbackSnackbar";
import "./FeedbackFeature.css";

export function FeedbackFeature({
  renderTrigger,
}: {
  renderTrigger: (
    open: () => void,
    returnFocusRef: RefObject<HTMLButtonElement | null>,
  ) => ReactNode;
}) {
  const isMobile = useIsMobileLayout();
  const [isOpen, setIsOpen] = useState(false);
  const [isSnackbarVisible, setIsSnackbarVisible] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submission = useFeedbackSubmission({
    onSuccess: () => {
      setIsOpen(false);
      setIsSnackbarVisible(true);
    },
  });
  const {
    clearError,
    canSubmit,
    content,
    errorMessage,
    isSubmitting,
    sentiment,
    setContent,
    setSentiment,
    submit,
  } = submission;
  useEffect(() => {
    if (!isSnackbarVisible) return;
    const timeout = window.setTimeout(() => setIsSnackbarVisible(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [isSnackbarVisible]);
  const { present, onExited } = useLayerPresence(isOpen);
  const values = useMemo(
    () => ({ canSubmit, content, errorMessage, isSubmitting, sentiment }),
    [canSubmit, content, errorMessage, isSubmitting, sentiment],
  );
  const snapshot = useExitSnapshot(isOpen, values) ?? values;
  const form = {
    ...snapshot,
    onClose: () => {
      if (!isSubmitting) setIsOpen(false);
    },
    onContentChange: setContent,
    onSentimentChange: setSentiment,
    onSubmit: submit,
    open: isOpen,
    onExited,
    returnFocusRef: triggerRef,
  };
  return (
    <>
      {renderTrigger(() => {
        clearError();
        setIsSnackbarVisible(false);
        setIsOpen(true);
      }, triggerRef)}
      {present &&
        (isMobile ? (
          <FeedbackBottomSheet {...form} />
        ) : (
          <FeedbackDialog {...form} />
        ))}
      {isSnackbarVisible && <FeedbackSnackbar />}
    </>
  );
}
