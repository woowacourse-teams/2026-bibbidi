import { useId, useRef } from "react";
import type { RefObject } from "react";
import { Dialog } from "../../../components/dialog";
import { Button } from "../../../components/button";
import { TextArea } from "../../../components/text-area";
import { FeedbackRatingField } from "./FeedbackRatingField";
import { MAX_FEEDBACK_LENGTH } from "../model/feedback";
import type { FeedbackFormViewProps } from "./feedbackFormView";

export function FeedbackDialog({
  open,
  onExited,
  returnFocusRef,
  canSubmit,
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
              disabled={!canSubmit}
              loading={isSubmitting}
            >
              {isSubmitting ? "보내는 중..." : "의견 보내기"}
            </Button>
          </div>
        </>
      }
    >
      <form
        id={formId}
        className="feedback-form"
        aria-busy={isSubmitting}
        onSubmit={onSubmit}
      >
        <FeedbackRatingField
          disabled={isSubmitting}
          onChange={onSentimentChange}
          value={sentiment}
        />
        <TextArea
          label="의견을 들려주세요"
          disabled={isSubmitting}
          maxLength={MAX_FEEDBACK_LENGTH}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="조금 더 자세히 알려주실래요? (선택)"
          value={content}
          rows={4}
        />
        {errorMessage && (
          <p className="feedback-form__error" role="alert">
            {errorMessage}
          </p>
        )}
      </form>
    </Dialog>
  );
}
