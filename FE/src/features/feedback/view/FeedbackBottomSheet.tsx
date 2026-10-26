import type { RefObject } from "react";
import { BottomSheet } from "../../../components/bottom-sheet";
import { Button } from "../../../components/button";
import { TextArea } from "../../../components/text-area";
import { usePageScrollContainer } from "../../../shared/scroll/usePageScrollContainer";
import { MAX_FEEDBACK_LENGTH } from "../model/feedback";
import type { FeedbackFormViewProps } from "./feedbackFormView";
import { FeedbackRatingField } from "./FeedbackRatingField";

export function FeedbackBottomSheet({
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
  const { ref, environment } = usePageScrollContainer();
  return (
    <div ref={ref}>
      {
        <BottomSheet
          open={open}
          onClose={onClose}
          onExited={onExited}
          returnFocusRef={returnFocusRef}
          scrollContainer={environment?.scrollContainer}
          className="feedback-bottom-sheet"
          hasTextField
          draggable={!isSubmitting}
          closeOnEscape={!isSubmitting}
          closeOnDimmerClick={!isSubmitting}
          header={<BottomSheet.Header>비비디, 어떠셨나요?</BottomSheet.Header>}
        >
          <form aria-busy={isSubmitting} onSubmit={onSubmit}>
            <FeedbackRatingField
              disabled={isSubmitting}
              onChange={onSentimentChange}
              value={sentiment}
            />
            <TextArea
              label="의견을 들려주세요 (선택)"
              disabled={isSubmitting}
              maxLength={MAX_FEEDBACK_LENGTH}
              onChange={(event) => onContentChange(event.target.value)}
              placeholder="조금 더 자세히 알려주실래요? (선택)"
              value={content}
              rows={4}
            />
            <Button
              disabled={!canSubmit}
              loading={isSubmitting}
              type="submit"
              display="block"
            >
              {isSubmitting ? "보내는 중..." : "의견 보내기"}
            </Button>
            {errorMessage && (
              <p className="feedback-form__error" role="alert">
                {errorMessage}
              </p>
            )}
          </form>
        </BottomSheet>
      }
    </div>
  );
}
