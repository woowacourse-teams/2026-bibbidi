import { useFeedbackForm } from "./useFeedbackForm";
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
  const {
    canSubmit,
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
  } = useFeedbackForm();

  return (
    <>
      <div className="feedback-feature" ref={containerRef}>
        {isOpen ? (
          <FeedbackPopover
            canSubmit={canSubmit}
            closeButtonRef={closeButtonRef}
            content={content}
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
