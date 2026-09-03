import type { RefObject, SubmitEvent } from "react";

import type { FeedbackSentiment } from "../useFeedbackForm";

export interface FeedbackFormViewProps {
  canSubmit: boolean;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  content: string;
  onClose: () => void;
  onContentChange: (content: string) => void;
  onSentimentChange: (sentiment: FeedbackSentiment) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  sentiment: FeedbackSentiment | null;
}
