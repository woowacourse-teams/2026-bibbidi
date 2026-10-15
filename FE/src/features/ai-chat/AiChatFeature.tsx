import { useEffect, useRef, useState } from "react";

import { useIsMobileLayout } from "../../shared/responsive";
import { useAiChatConversation } from "./hooks/useAiChatConversation";
import { MobileAiChatDialog } from "./view/MobileAiChatDialog";
import type { AiChatView } from "./view/AiChatView";
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
  const [hasOpened, setHasOpened] = useState(false);
  const [View, setView] = useState<typeof AiChatView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const shouldLoad = !isMobile || hasOpened;

  useEffect(() => {
    if (!shouldLoad || View) return;
    let cancelled = false;
    import("./view/AiChatView").then(
      (module) => {
        if (!cancelled) setView(() => module.AiChatView);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [shouldLoad, View, loadAttempt]);
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const { draft, messages, errorMessage, isPending, setDraft, send, retry } =
    useAiChatConversation(onAuthenticationRequired);
  const openChat = (launcher: HTMLButtonElement) => {
    returnFocusRef.current = launcher;
    setHasOpened(true);
    setOpen(true);
  };
  const closeChat = () => setOpen(false);
  const view = View ? (
    <View
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
  ) : shouldLoad ? (
    <div className="ai-chat">
      {loadFailed ? (
        <div role="alert">
          <p>채팅을 불러오지 못했어요.</p>
          <button
            onClick={() => {
              setLoadFailed(false);
              setLoadAttempt((attempt) => attempt + 1);
            }}
            type="button"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <p role="status">채팅을 불러오고 있어요.</p>
      )}
    </div>
  ) : null;

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
