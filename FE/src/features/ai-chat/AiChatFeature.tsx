import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/button";
import type { AiChatSession } from "./AiChatSession";
import "./view/AiChat.css";

export function AiChatFeature({
  isAuthenticated,
  onAuthenticationRequired,
  contextLabel,
}: {
  isAuthenticated: boolean;
  onAuthenticationRequired: () => void;
  contextLabel?: string;
}) {
  const [isOpen, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [Session, setSession] = useState<typeof AiChatSession | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const loading = hasOpened && !Session && !loadFailed;
  useEffect(() => {
    if (!hasOpened || Session) return;
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
  }, [hasOpened, Session, loadAttempt]);
  return (
    <div className="ai-chat-feature">
      <Button
        size="medium"
        variant="weak"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={loadFailed ? "AI 도움 다시 시도" : "AI 도움"}
        disabled={loading}
        onClick={() => {
          if (loadFailed) {
            setLoadFailed(false);
            setLoadAttempt((attempt) => attempt + 1);
          }
          setHasOpened(true);
          setOpen(true);
        }}
        ref={returnFocusRef}
      >
        {loading ? (
          <span role="status">채팅을 불러오고 있어요.</span>
        ) : loadFailed ? (
          "다시 시도"
        ) : (
          "AI 도움"
        )}
      </Button>
      {loadFailed && (
        <span className="ai-chat__sr-only" role="alert">
          채팅을 불러오지 못했어요. AI 도움 다시 시도를 선택해 주세요.
        </span>
      )}
      {Session && (
        <Session
          contextLabel={contextLabel}
          isAuthenticated={isAuthenticated}
          isOpen={isOpen}
          onAuthenticationRequired={onAuthenticationRequired}
          onClose={() => setOpen(false)}
          returnFocusRef={returnFocusRef}
        />
      )}
    </div>
  );
}
