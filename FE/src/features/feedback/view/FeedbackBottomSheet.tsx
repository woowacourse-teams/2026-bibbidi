import type { RefObject } from "react";
import { BottomSheet } from "../../../components/bottom-sheet";
import { Button } from "../../../components/button";
import { usePageScrollContainer } from "../../../shared/scroll/usePageScrollContainer";
import type { FeedbackFormViewProps } from "./feedbackFormView";
import { FeedbackFormFields } from "./FeedbackFormFields";

export function FeedbackBottomSheet({
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
  const { ref, environment } = usePageScrollContainer();
  return (
    <div ref={ref}>
      <BottomSheet
        open={open}
        onClose={onClose}
        onExited={onExited}
        returnFocusRef={returnFocusRef}
        scrollContainer={environment?.scrollContainer}
        hasTextField
        draggable={!isSubmitting}
        closeOnEscape={!isSubmitting}
        closeOnDimmerClick={!isSubmitting}
        header={<BottomSheet.Header>비비디, 어떠셨나요?</BottomSheet.Header>}
      >
        <form
          className="feedback-form"
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
          <Button
            disabled={sentiment === null}
            loading={isSubmitting}
            type="submit"
            display="block"
          >
            의견 보내기
          </Button>
        </form>
      </BottomSheet>
    </div>
  );
}
