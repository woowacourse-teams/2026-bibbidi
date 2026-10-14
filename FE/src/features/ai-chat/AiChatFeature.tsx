import { useRef, useState } from "react";

import { useIsMobileLayout } from "../../shared/responsive";
import { useAiChatConversation } from "./hooks/useAiChatConversation";
import { MobileAiChatDialog } from "./view/MobileAiChatDialog";
import { AiChatView } from "./view/AiChatView";
import "./view/AiChat.css";

export function AiChatFeature({
  isAuthenticated,
  onAuthenticationRequired,
}: {
  isAuthenticated: boolean;
  onAuthenticationRequired: () => void;
}) {
  const isMobile = useIsMobileLayout();
  const [isOpen, setOpen] = useState(false);
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const { draft, messages, errorMessage, isPending, setDraft, send, retry } =
    useAiChatConversation(onAuthenticationRequired);
  const openChat = (launcher: HTMLButtonElement) => {
    returnFocusRef.current = launcher;
    setOpen(true);
  };
  const closeChat = () => setOpen(false);
  const view = (
    <AiChatView
      active={!isMobile || isOpen}
      isAuthenticated={isAuthenticated}
      draft={isAuthenticated ? draft : ""}
      messages={isAuthenticated ? messages : []}
      errorMessage={isAuthenticated ? errorMessage : null}
      isPending={isAuthenticated && isPending}
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

  return (
    <div className="ai-chat-feature">
      {isMobile ? (
        <>
          <div className="ai-chat-launchers">
            <button
              className="ai-chat-launchers__action"
              onClick={(event) => openChat(event.currentTarget)}
              type="button"
            >
              AI와 대화하기
            </button>
          </div>
          <MobileAiChatDialog
            isOpen={isOpen}
            onClose={closeChat}
            returnFocusRef={returnFocusRef}
          >
            {view}
          </MobileAiChatDialog>
        </>
      ) : (
        <aside aria-label="AI 채팅" className="ai-chat-panel">
          {view}
        </aside>
      )}
    </div>
  );
}
