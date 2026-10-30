import { useId, useRef } from "react";
import type { RefObject } from "react";
import { Dialog } from "../../../components/dialog";
import { Button } from "../../../components/button";
import { FeedbackFormFields } from "./FeedbackFormFields";
import type { FeedbackFormViewProps } from "./feedbackFormView";

export function FeedbackDialog({
  open,
  onExited,
  returnFocusRef,
  content,
  errorMessage,
  isSubmitting,
  onClose,
  onContentChange,
  onSentimentChange,
  onSubmit,
  sentiment,
}: FeedbackFormViewProps & {
  open: boolean;
  onExited: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const formId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={onExited}
      returnFocusRef={returnFocusRef}
      initialFocusRef={cancelRef}
      closeOnEscape={!isSubmitting}
      closeOnDimmerClick={!isSubmitting}
      title={<Dialog.Title>비비디, 어떠셨나요?</Dialog.Title>}
      actions={
        <>
          <div>
            <Button
              ref={cancelRef}
              color="dark"
              variant="weak"
              display="block"
              disabled={isSubmitting}
              onClick={onClose}
            >
              닫기
            </Button>
          </div>
          <div>
            <Button
              display="block"
              form={formId}
              type="submit"
              disabled={sentiment === null}
              loading={isSubmitting}
            >
              의견 보내기
            </Button>
          </div>
        </>
      }
    >
      <form
        id={formId}
        className="feedback-form feedback-form--dialog"
        aria-busy={isSubmitting}
        onSubmit={onSubmit}
      >
        <FeedbackFormFields
          content={content}
          errorMessage={errorMessage}
          isSubmitting={isSubmitting}
          onContentChange={onContentChange}
          onSentimentChange={onSentimentChange}
          sentiment={sentiment}
        />
      </form>
    </Dialog>
  );
}
