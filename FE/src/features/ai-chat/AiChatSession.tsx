import { RefObject, useState } from "react";

import { useAiChatConversation } from "./hooks/useAiChatConversation";
import { useAiChatRecommendations } from "./hooks/useAiChatRecommendations";
import { MobileAiChatDialog } from "./view/MobileAiChatDialog";
import { AiChatView } from "./view/AiChatView";
import { createGuestChatMessages, type ChatMessage } from "./model/aiChat";
import type { RecommendationController } from "./model/recommendation";

function GuestAiChatView({
  active,
  recommendations,
}: {
  active: boolean;
  recommendations: RecommendationController;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  return (
    <AiChatView
      active={active}
      isAuthenticated={false}
      draft=""
      messages={messages}
      errorMessage={null}
      isPending={false}
      recommendations={recommendations}
      onDraftChange={() => {}}
      onRetry={() => {}}
      onSend={(question) => {
        const nextMessages = createGuestChatMessages(question);
        if (nextMessages) setMessages(nextMessages);
      }}
    />
  );
}

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
  const active = !isMobile || isOpen;
  const view = isAuthenticated ? (
    <AiChatView
      active={active}
      isAuthenticated
      draft={draft}
      messages={messages}
      errorMessage={errorMessage}
      isPending={isPending}
      recommendations={recommendations}
      onDraftChange={setDraft}
      onSend={send}
      onRetry={retry}
    />
  ) : (
    <GuestAiChatView active={active} recommendations={recommendations} />
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
