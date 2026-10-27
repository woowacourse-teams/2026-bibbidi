import { useRef, type ReactNode, type RefObject } from "react";
import { PanelOverlay } from "../../../components/panel-overlay";
import { CloseIcon } from "../../../components/icons/ActionIcons";
import { IconButton } from "../../../components/icon-button";
import { useMediaQuery } from "../../../shared/responsive";

export const AI_CHAT_FULLSCREEN_MEDIA_QUERY = "(width < 1024px)";

/** The common overlay retains its children after the first open. */
export function GlobalAiChatDialog({
  open,
  onClose,
  returnFocusRef,
  contextLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  contextLabel?: string;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const fullscreen = useMediaQuery(AI_CHAT_FULLSCREEN_MEDIA_QUERY);
  return (
    <PanelOverlay
      open={open}
      onClose={onClose}
      placement={fullscreen ? "fullscreen" : "side"}
      width="focus"
      aria-label="AI 채팅"
      initialFocusRef={closeRef}
      returnFocusRef={returnFocusRef}
      scrollContainer={
        typeof document === "undefined"
          ? null
          : document.querySelector<HTMLElement>("[data-page-scroll-container]")
      }
    >
      <div className="global-ai-content">
        <header className="global-ai-content__header">
          <div>
            <h2>AI 도움</h2>
            {contextLabel && <p>현재 화면 참고 · {contextLabel}</p>}
          </div>
          <IconButton
            ref={closeRef}
            variant="clear"
            aria-label="AI 채팅 닫기"
            onClick={onClose}
            icon={<CloseIcon size={20} />}
          />
        </header>
        {children}
      </div>
    </PanelOverlay>
  );
}
