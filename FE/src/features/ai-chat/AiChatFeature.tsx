import { useRef, useState } from "react";

import { useIsMobileLayout } from "../../shared/responsive";
import { useAiChatConversation } from "./hooks/useAiChatConversation";
import { MobileAiChatDialog } from "./view/MobileAiChatDialog";
import { AiChatView, ChatIcon } from "./view/AiChatView";
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
  const view = isAuthenticated ? (
    <AiChatView
      active={!isMobile || isOpen}
      draft={draft}
      messages={messages}
      errorMessage={errorMessage}
      isPending={isPending}
      onDraftChange={setDraft}
      onSend={send}
      onRetry={retry}
    />
  ) : (
    <div className="ai-chat">
      <div className="ai-chat__welcome">
        <h2>로그인하고 AI와 대화해요</h2>
        <p>나의 결혼 준비에 맞는 안내를 받아보세요.</p>
        <a className="ai-chat__login" href="/login">
          로그인
        </a>
      </div>
    </div>
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
