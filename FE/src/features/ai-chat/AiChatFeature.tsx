import { useRef, useState } from "react";

import { useIsMobileLayout } from "../../shared/responsive";
import { useAiChatConversation } from "./hooks/useAiChatConversation";
import { MobileAiChatDialog } from "./view/MobileAiChatDialog";
import { AiChatView, ChatIcon } from "./view/AiChatView";
import "./view/AiChat.css";

export function AiChatFeature() {
  const isMobile = useIsMobileLayout();
  const [isOpen, setIsOpen] = useState(false);
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const { draft, messages, setDraft, send, chooseCard } =
    useAiChatConversation();

  const openChat = (launcher: HTMLButtonElement) => {
    returnFocusRef.current = launcher;
    setIsOpen(true);
  };

  const view = (
    <AiChatView
      active={!isMobile || isOpen}
      draft={draft}
      messages={messages}
      onChooseCard={chooseCard}
      onDraftChange={setDraft}
      onSend={send}
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
              AI와 할 일 만들기
            </button>
            <button
              aria-label="AI 채팅 열기"
              className="ai-chat-launchers__icon"
              onClick={(event) => openChat(event.currentTarget)}
              type="button"
            >
              <ChatIcon />
            </button>
          </div>
          <MobileAiChatDialog
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            returnFocusRef={returnFocusRef}
          >
            {view}
          </MobileAiChatDialog>
        </>
      ) : (
        <aside aria-label="AI 채팅" className="ai-chat-panel">
          <span className="ai-chat-panel__badge">예시 대화</span>
          {view}
        </aside>
      )}
    </div>
  );
}
