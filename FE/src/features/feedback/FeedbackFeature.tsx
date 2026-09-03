import { useEffect, useState } from "react";

import { useFeedbackForm } from "./useFeedbackForm";
import { FeedbackBottomSheet } from "./view/FeedbackBottomSheet";
import { FeedbackPopover } from "./view/FeedbackPopover";
import { FeedbackSnackbar } from "./view/FeedbackSnackbar";
import "./FeedbackFeature.css";

function FeedbackIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.75 5.75h14.5v10.5H10l-4.5 3v-3h-.75v-10.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8 10h8M8 13h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

const MOBILE_MEDIA_QUERY = "(max-width: 760px)";

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia?.(MOBILE_MEDIA_QUERY).matches ?? false,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(MOBILE_MEDIA_QUERY);

    if (!mediaQuery) {
      return;
    }

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}

export function FeedbackFeature() {
  const isMobile = useIsMobileViewport();
  const {
    canSubmit,
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
  } = useFeedbackForm();

  return (
    <>
      <div className="feedback-feature" ref={containerRef}>
        {isOpen && isMobile ? (
          <FeedbackBottomSheet
            canSubmit={canSubmit}
            closeButtonRef={closeButtonRef}
            content={content}
            errorMessage={errorMessage}
            isSubmitting={isSubmitting}
            onClose={close}
            onContentChange={setContent}
            onSentimentChange={setSentiment}
            onSubmit={submit}
            sentiment={sentiment}
          />
        ) : isOpen ? (
          <FeedbackPopover
            canSubmit={canSubmit}
            closeButtonRef={closeButtonRef}
            content={content}
            errorMessage={errorMessage}
            isSubmitting={isSubmitting}
            onClose={close}
            onContentChange={setContent}
            onSentimentChange={setSentiment}
            onSubmit={submit}
            sentiment={sentiment}
          />
        ) : null}

        <button
          aria-label="의견 보내기"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className="feedback-feature__trigger"
          onClick={open}
          ref={triggerButtonRef}
          type="button"
        >
          <FeedbackIcon />
          <span className="feedback-feature__trigger-label">의견 보내기</span>
        </button>
      </div>

      {isSnackbarVisible ? <FeedbackSnackbar /> : null}
    </>
  );
}
