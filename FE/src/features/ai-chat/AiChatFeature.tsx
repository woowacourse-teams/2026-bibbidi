import { useEffect, useRef, useState } from "react";

import { useIsMobileLayout } from "../../shared/responsive";
import type { AiChatSession } from "./AiChatSession";
import "./view/AiChat.css";

export function AiChatFeature({
  isAuthenticated,
  onAuthenticationRequired,
  onTaskAdded,
  isRevealingTask = false,
}: {
  isAuthenticated: boolean;
  onAuthenticationRequired: () => void;
  onTaskAdded?: (catalogItemId: number) => void;
  isRevealingTask?: boolean;
}) {
  const isMobile = useIsMobileLayout();
  const [isOpen, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [Session, setSession] = useState<typeof AiChatSession | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const shouldLoad = !isMobile || hasOpened;
  const loading = shouldLoad && !Session && !loadFailed;

  useEffect(() => {
    if (!shouldLoad || Session) return;
    let cancelled = false;
    import("./AiChatSession").then(
      (module) => {
        if (!cancelled) setSession(() => module.AiChatSession);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [shouldLoad, Session, loadAttempt]);

  const retryLoad = () => {
    setLoadFailed(false);
    setLoadAttempt((attempt) => attempt + 1);
  };

  return (
    <div className="ai-chat-feature">
      {isMobile ? (
        <div
          className={`ai-chat-launchers${loadFailed ? " ai-chat-launchers--error" : ""}`}
        >
          {loadFailed ? <p role="alert">채팅을 불러오지 못했어요.</p> : null}
          <button
            className="ai-chat-launchers__action"
            disabled={loading || isRevealingTask}
            onClick={() => {
              if (loadFailed) retryLoad();
              setHasOpened(true);
              setOpen(true);
            }}
            ref={returnFocusRef}
            type="button"
          >
            {loading ? (
              <span role="status">채팅을 불러오고 있어요.</span>
            ) : loadFailed ? (
              "다시 시도"
            ) : (
              "AI와 대화하기"
            )}
          </button>
        </div>
      ) : null}
      {Session ? (
        <Session
          isAuthenticated={isAuthenticated}
          isMobile={isMobile}
          isOpen={isOpen && !isRevealingTask}
          onAuthenticationRequired={onAuthenticationRequired}
          onTaskAdded={onTaskAdded}
          onClose={() => setOpen(false)}
          returnFocusRef={returnFocusRef}
        />
      ) : !isMobile ? (
        <aside aria-label="AI 채팅" className="ai-chat-panel">
          <div className="ai-chat">
            {loadFailed ? (
              <div role="alert">
                <p>채팅을 불러오지 못했어요.</p>
                <button onClick={retryLoad} type="button">
                  다시 시도
                </button>
              </div>
            ) : (
              <p role="status">채팅을 불러오고 있어요.</p>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
