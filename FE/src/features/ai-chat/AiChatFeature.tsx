import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useIsMobileLayout } from "../../shared/responsive";
import type { AiChatSession } from "./AiChatSession";
import "./view/AiChat.css";

export function AiChatFeature({
  isAuthenticated,
  feedbackAudienceKey = "authenticated",
  onAuthenticationRequired,
  contextLabel,
  launcherLabel = "AI",
  launcherClassName,
  renderLauncher,
  onKeyboardVisibilityChange,
}: {
  isAuthenticated: boolean;
  feedbackAudienceKey?: string;
  onAuthenticationRequired: () => void;
  contextLabel?: string;
  launcherLabel?: string;
  launcherClassName?: string;
  renderLauncher?: (launcher: ReactNode) => ReactNode;
  onKeyboardVisibilityChange?: (visible: boolean) => void;
}) {
  const isMobile = useIsMobileLayout();
  const { key: navigationKey } = useLocation();
  const [openState, setOpenState] = useState({ navigationKey, isOpen: false });
  const isOpen =
    openState.isOpen &&
    (!isMobile || openState.navigationKey === navigationKey);
  if (openState.navigationKey !== navigationKey) {
    setOpenState({ navigationKey, isOpen: !isMobile && openState.isOpen });
  }
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
  const launcher = (
    <button
      type="button"
      className={["ai-chat-launcher", launcherClassName]
        .filter(Boolean)
        .join(" ")}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label={loadFailed ? `${launcherLabel} 다시 시도` : launcherLabel}
      aria-busy={loading}
      disabled={loading}
      onClick={() => {
        if (loadFailed) {
          setLoadFailed(false);
          setLoadAttempt((attempt) => attempt + 1);
        }
        setHasOpened(true);
        setOpenState({
          navigationKey,
          isOpen: isMobile || !isOpen || loadFailed,
        });
      }}
      ref={returnFocusRef}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M20 11.5a8 8 0 0 1-8 8H8l-5 2v-6a8 8 0 1 1 17-4Z" />
        <path d="M8 10h8M8 14h5" />
      </svg>
      <span>{loadFailed ? "다시 시도" : launcherLabel}</span>
    </button>
  );
  return (
    <div className="ai-chat-feature">
      {renderLauncher ? renderLauncher(launcher) : launcher}
      {loading && (
        <span className="ai-chat__sr-only" role="status">
          채팅을 불러오고 있어요.
        </span>
      )}
      {loadFailed && (
        <span className="ai-chat__sr-only" role="alert">
          채팅을 불러오지 못했어요. {launcherLabel} 다시 시도를 선택해 주세요.
        </span>
      )}
      {Session && (
        <Session
          feedbackAudienceKey={feedbackAudienceKey}
          contextLabel={contextLabel}
          onKeyboardVisibilityChange={onKeyboardVisibilityChange}
          isAuthenticated={isAuthenticated}
          isOpen={isOpen}
          onAuthenticationRequired={onAuthenticationRequired}
          onClose={() => setOpenState({ navigationKey, isOpen: false })}
          returnFocusRef={returnFocusRef}
        />
      )}
    </div>
  );
}
