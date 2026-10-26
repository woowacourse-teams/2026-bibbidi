import { useRef } from "react";
import type { ComponentPropsWithoutRef, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { containTabFocus } from "../../shared/focus/containTabFocus";
import { useNativeModalLifecycle } from "../../shared/modal/useNativeModalLifecycle";
import { useVisualViewport } from "../../shared/modal/useVisualViewport";
import "./PanelOverlay.css";

export type PanelOverlayPlacement = "side" | "fullscreen";
type AccessibleName =
  | { "aria-label": string; "aria-labelledby"?: string }
  | { "aria-label"?: string; "aria-labelledby": string };
export type PanelOverlayProps = Omit<
  ComponentPropsWithoutRef<"dialog">,
  | "open"
  | "onClose"
  | "onCancel"
  | "children"
  | "aria-label"
  | "aria-labelledby"
  | "aria-modal"
  | "role"
> &
  AccessibleName & {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    placement?: PanelOverlayPlacement;
    closeOnEscape?: boolean;
    closeOnDimmerClick?: boolean;
    portalContainer?: HTMLElement | null;
    /** Lock a dedicated app scroll area as well as the document body. */
    scrollContainer?: HTMLElement | null;
    initialFocusRef?: RefObject<HTMLElement | null>;
    returnFocusRef?: RefObject<HTMLElement | null>;
    fallbackFocusRef?: RefObject<HTMLElement | null>;
    /** Disable when a screen owns focus across docked/modal presentation changes. */
    restoreFocus?: boolean;
    onEntered?: () => void;
    onExited?: () => void;
  };

/** Modal behavior only. Content and close/confirmation policy belong to the owner. */
export function PanelOverlay({
  open,
  onClose,
  children,
  placement = "side",
  closeOnEscape = true,
  closeOnDimmerClick = true,
  portalContainer,
  scrollContainer,
  initialFocusRef,
  returnFocusRef,
  fallbackFocusRef,
  restoreFocus = true,
  onEntered,
  onExited,
  className,
  onKeyDown,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...props
}: PanelOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dimmerPress = useRef(false);
  const ready = useNativeModalLifecycle({
    open,
    deferContents: true,
    dialogRef,
    surfaceRef,
    portalContainer,
    scrollContainer,
    initialFocusRef,
    returnFocusRef,
    fallbackFocusRef,
    restoreFocus,
    onEntered,
    onExited,
    motionPrefix: "panel-overlay",
  });
  useVisualViewport({
    active: open,
    rootRef: dialogRef,
    prefix: "panel-overlay",
  });

  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      {...props}
      ref={dialogRef}
      tabIndex={-1}
      aria-modal="true"
      className={["bibbidi-panel-overlay", className].filter(Boolean).join(" ")}
      data-placement={placement}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        // React events also bubble through portals; a nested modal owns its keys.
        if (
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          !event.currentTarget.contains(event.target as Node)
        )
          return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (open && closeOnEscape) onClose();
        } else if (event.key === "Tab") {
          containTabFocus(event, event.currentTarget);
          event.stopPropagation();
        }
      }}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        if (open && closeOnEscape) onClose();
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        dimmerPress.current =
          !event.defaultPrevented &&
          event.button === 0 &&
          event.isPrimary !== false &&
          event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        const outside =
          !event.defaultPrevented &&
          dimmerPress.current &&
          event.target === event.currentTarget;
        dimmerPress.current = false;
        if (outside && open && closeOnDimmerClick && placement === "side")
          onClose();
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        dimmerPress.current = false;
      }}
    >
      <div
        ref={surfaceRef}
        className="bibbidi-panel-overlay-surface"
        inert={!open || undefined}
      >
        {ready ? children : null}
      </div>
    </dialog>,
    portalContainer ?? document.body,
  );
}
