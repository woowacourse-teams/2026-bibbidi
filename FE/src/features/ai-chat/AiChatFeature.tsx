import { useRef } from "react";

import { useIsMobileLayout } from "../../shared/responsive";
import { useAiChatConversation } from "./hooks/useAiChatConversation";
import type { ExampleTaskAdditionController } from "./hooks/useExampleTaskAddition";
import { MobileAiChatDialog } from "./view/MobileAiChatDialog";
import { AiChatView, ChatIcon } from "./view/AiChatView";
import "./view/AiChat.css";

export function AiChatFeature({
  addition,
}: {
  addition: Pick<
    ExampleTaskAdditionController,
    "add" | "addedTaskCount" | "isChatOpen" | "setChatOpen" | "showAddedTasks"
  >;
}) {
  const isMobile = useIsMobileLayout();
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const { draft, messages, setDraft, send, chooseCard } = useAiChatConversation(
    addition.add,
  );

  const closeChat = () => {
    addition.setChatOpen(false);
  };

  const openChat = (launcher: HTMLButtonElement) => {
    returnFocusRef.current = launcher;
    addition.setChatOpen(true);
  };

  const view = (
    <AiChatView
      active={!isMobile || addition.isChatOpen}
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
            isOpen={addition.isChatOpen}
            onClose={closeChat}
            returnFocusRef={returnFocusRef}
          >
            {view}
            {addition.addedTaskCount > 0 ? (
              <button
                className="ai-chat__show-added"
                onClick={() => {
                  returnFocusRef.current = null;
                  addition.showAddedTasks();
                }}
                type="button"
              >
                추가한 할 일 {addition.addedTaskCount}개 보기{" "}
                <span aria-hidden="true">→</span>
              </button>
            ) : null}
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
