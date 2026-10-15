import { RefObject } from "react";

import { useAiChatConversation } from "./hooks/useAiChatConversation";
import { useAiChatRecommendations } from "./hooks/useAiChatRecommendations";
import { MobileAiChatDialog } from "./view/MobileAiChatDialog";
import { AiChatView } from "./view/AiChatView";

export function AiChatSession({
  isAuthenticated,
  isMobile,
  isOpen,
  onAuthenticationRequired,
  onTaskAdded,
  onClose,
  returnFocusRef,
}: {
  isAuthenticated: boolean;
  isMobile: boolean;
  isOpen: boolean;
  onAuthenticationRequired: () => void;
  onTaskAdded?: (catalogItemId: number) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const { draft, messages, errorMessage, isPending, setDraft, send, retry } =
    useAiChatConversation(onAuthenticationRequired);
  const recommendations = useAiChatRecommendations(
    messages,
    isAuthenticated,
    onAuthenticationRequired,
    onTaskAdded,
  );
  const view = (
    <AiChatView
      active={!isMobile || isOpen}
      isAuthenticated={isAuthenticated}
      draft={isAuthenticated ? draft : ""}
      messages={isAuthenticated ? messages : []}
      errorMessage={isAuthenticated ? errorMessage : null}
      isPending={isAuthenticated && isPending}
      recommendations={recommendations}
      onDraftChange={(value) => {
        if (isAuthenticated) setDraft(value);
      }}
      onSend={(text) => {
        if (isAuthenticated) send(text);
      }}
      onRetry={() => {
        if (isAuthenticated) retry();
      }}
    />
  );

  return isMobile ? (
    <MobileAiChatDialog
      isOpen={isOpen}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      {view}
    </MobileAiChatDialog>
  ) : (
    <aside aria-label="AI 채팅" className="ai-chat-panel">
      {view}
    </aside>
  );
}
