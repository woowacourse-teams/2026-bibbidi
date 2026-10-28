import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../../../components/icons/ActionIcons";
import { IconButton } from "../../../components/icon-button";
import { canFocus } from "../../../shared/focus/canFocus";
import { viewportStyles, type ViewportMetrics } from "../../../shared/viewport";
import { useIsMobileLayout } from "../../../shared/responsive";

/** Keep the same conversation and input while resizing the mobile window. */
export function GlobalAiChatDialog({
  open,
  viewport,
  keyboardOpen,
  mobileExpanded,
  onMobileCollapse,
  onClose,
  returnFocusRef,
  children,
}: {
  open: boolean;
  viewport: ViewportMetrics;
  keyboardOpen: boolean;
  mobileExpanded: boolean;
  onMobileCollapse: () => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const isMobile = useIsMobileLayout();
  const compact = isMobile && !mobileExpanded;
  const dismiss = isMobile && mobileExpanded ? onMobileCollapse : onClose;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (
        wasOpenRef.current &&
        (dialog.contains(document.activeElement) ||
          document.activeElement === document.body)
      )
        returnFocusRef.current?.focus({ preventScroll: true });
      wasOpenRef.current = false;
      lastFocusedRef.current = null;
      return;
    }
    wasOpenRef.current = true;
    if (canFocus(lastFocusedRef.current))
      lastFocusedRef.current.focus({ preventScroll: true });
    else if (!isMobile) closeRef.current?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      lastFocusedRef.current =
        active instanceof HTMLElement && dialog.contains(active)
          ? active
          : null;
    };
  }, [open, isMobile, returnFocusRef]);

  useLayoutEffect(() => {
    const active = document.activeElement;
    if (
      open &&
      isMobile &&
      mobileExpanded &&
      active instanceof HTMLElement &&
      dialogRef.current?.contains(active) &&
      !canFocus(active)
    )
      closeRef.current?.focus({ preventScroll: true });
  }, [open, isMobile, mobileExpanded]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={dialogRef}
      open={open}
      className="global-ai-window"
      data-placement={isMobile ? "mobile" : "floating"}
      data-expanded={!compact}
      data-keyboard-open={keyboardOpen}
      style={viewportStyles(viewport, "global-ai")}
      aria-label="AI 채팅"
      aria-modal="false"
      tabIndex={-1}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }}
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          !event.currentTarget.contains(event.target as Node)
        )
          return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          dismiss();
        }
      }}
    >
      <div className="global-ai-content">
        <header className="global-ai-content__header" hidden={compact}>
          <h2>AI</h2>
          <IconButton
            ref={closeRef}
            variant="clear"
            aria-label={isMobile ? "AI 대화 접기" : "AI 채팅 닫기"}
            onClick={dismiss}
            icon={
              isMobile ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              ) : (
                <CloseIcon size={20} />
              )
            }
          />
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
