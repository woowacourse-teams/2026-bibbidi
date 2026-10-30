import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../../../components/icons/ActionIcons";
import { ChevronDown } from "../../../components/icons/Chevron";
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
  const wasExpandedRef = useRef(false);
  const isMobile = useIsMobileLayout();
  const compact = isMobile && !mobileExpanded;
  const dismiss = isMobile && mobileExpanded ? onMobileCollapse : onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !isMobile || !dialog) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.button !== 0 || event.isPrimary === false) return;
      const path = event.composedPath();
      if (
        path.includes(dialog) ||
        (returnFocusRef.current && path.includes(returnFocusRef.current))
      )
        return;
      onClose();
    };
    const document = dialog.ownerDocument;
    document.addEventListener("pointerdown", closeOnOutside, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutside, true);
  }, [open, isMobile, onClose, returnFocusRef]);

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
    const collapsed = wasExpandedRef.current && !mobileExpanded;
    wasExpandedRef.current = open && isMobile && mobileExpanded;
    if (!open || !isMobile) return;
    const active = document.activeElement;
    if (collapsed) {
      if (active instanceof HTMLElement && dialogRef.current?.contains(active))
        active.blur();
      // Blur first so the layout can reveal the dock before restoring focus.
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) returnFocusRef.current?.focus({ preventScroll: true });
      });
      return () => {
        cancelled = true;
      };
    }
    if (
      mobileExpanded &&
      active instanceof HTMLElement &&
      dialogRef.current?.contains(active) &&
      !canFocus(active)
    )
      closeRef.current?.focus({ preventScroll: true });
  }, [open, isMobile, mobileExpanded, returnFocusRef]);

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
                <ChevronDown aria-hidden="true" />
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
