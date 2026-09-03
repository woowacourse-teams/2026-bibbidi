import type { RefObject, SubmitEvent } from "react";

import type { FeedbackSentiment } from "../model/feedback";

export interface FeedbackFormViewProps {
  canSubmit: boolean;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  content: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onContentChange: (content: string) => void;
  onSentimentChange: (sentiment: FeedbackSentiment) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  sentiment: FeedbackSentiment | null;
}
