import { useIsMobileLayout } from "../../shared/responsive";
import { useFeedbackForm } from "./useFeedbackForm";
import { useFeedbackOpeningAnimation } from "./useFeedbackOpeningAnimation";
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

export function FeedbackFeature() {
  const isMobile = useIsMobileLayout();
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
  } = useFeedbackForm({ isMobile });

  useFeedbackOpeningAnimation({
    containerRef,
    triggerRef: triggerButtonRef,
    isOpen,
    isMobile,
  });
  const FeedbackForm = isMobile ? FeedbackBottomSheet : FeedbackPopover;

  return (
    <>
      <div className="feedback-feature" ref={containerRef}>
        {isOpen ? (
          <FeedbackForm
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
