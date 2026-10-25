import { useId, useLayoutEffect, useRef } from "react";
import type { ComponentPropsWithoutRef, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "../button";
import type { ButtonProps } from "../button";
import { canRestoreFocus } from "../../shared/focus/useReturnFocus";
import { containTabFocus } from "../../shared/focus/containTabFocus";
import "./Dialog.css";

export type DialogProps = Omit<
  ComponentPropsWithoutRef<"dialog">,
  "open" | "onClose" | "onCancel" | "title" | "children"
> & {
  open: boolean;
  onClose: () => void;
  onEscape?: () => void;
  onDimmerClick?: () => void;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
  closeOnDimmerClick?: boolean;
  closeOnEscape?: boolean;
  portalContainer?: HTMLElement | null;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Restore the owning trigger when the dialog is used inside another overlay. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  onEntered?: () => void;
  onExited?: () => void;
};
export type AlertDialogProps = Omit<DialogProps, "actions"> & {
  alertButton: ReactNode;
};
export type ConfirmDialogProps = Omit<DialogProps, "actions"> & {
  cancelButton: ReactNode;
  confirmButton: ReactNode;
};

function Root({
  open,
  onClose,
  onEscape,
  onDimmerClick,
  fallbackFocusRef,
  title,
  description,
  children,
  actions,
  closeOnDimmerClick = true,
  closeOnEscape = true,
  portalContainer,
  initialFocusRef,
  returnFocusRef,
  onEntered,
  onExited,
  className,
  role = "dialog",
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  onPointerDown,
  onPointerUp,
  onKeyDown,
  ...props
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const backdropPress = useRef(false);
  const restore = useRef<(() => void) | null>(null);
  const callbacks = useRef({ onEntered, onExited, initialFocusRef });
  useLayoutEffect(() => {
    callbacks.current = { onEntered, onExited, initialFocusRef };
  });

  useLayoutEffect(
    () => () => {
      restore.current?.();
      restore.current = null;
    },
    [portalContainer],
  );
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    let cancelled = false;
    const afterAnimation = (callback: () => void) => {
      const animations = surfaceRef.current?.getAnimations?.() ?? [];
      Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => {
        if (!cancelled) callback();
      });
    };
    if (open) {
      if (!dialog.open) {
        const previous = returnFocusRef?.current ?? document.activeElement;
        delete dialog.dataset.state;
        dialog.showModal();
        restore.current = () => {
          dialog.close();
          queueMicrotask(() => {
            const target = canRestoreFocus(previous)
              ? previous
              : fallbackFocusRef?.current;
            if (target && canRestoreFocus(target))
              target.focus({ preventScroll: true });
          });
        };
        const initial =
          callbacks.current.initialFocusRef?.current ??
          actionsRef.current?.querySelector<HTMLElement>(
            'button:not(:disabled):not([aria-disabled="true"]), a[href], [tabindex="0"]',
          );
        if (initial && dialog.contains(initial))
          initial.focus({ preventScroll: true });
      }
      dialog.dataset.state = "open";
      afterAnimation(() => callbacks.current.onEntered?.());
    } else if (dialog.open) {
      dialog.dataset.state = "closing";
      afterAnimation(() => {
        restore.current?.();
        restore.current = null;
        callbacks.current.onExited?.();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [open, portalContainer, returnFocusRef, fallbackFocusRef]);

  function rejectDismiss() {
    const panel = panelRef.current;
    if (
      !panel ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      !panel.animate
    )
      return;
    panel.getAnimations?.().forEach((animation) => animation.cancel());
    panel.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 220, easing: "ease-out" },
    );
  }
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      tabIndex={-1}
      {...props}
      ref={dialogRef}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy ?? titleId}
      aria-describedby={
        [describedBy, description ? descriptionId : undefined]
          .filter(Boolean)
          .join(" ") || undefined
      }
      className={["bibbidi-dialog", className].filter(Boolean).join(" ")}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (closeOnEscape) (onEscape ?? onClose)();
          else rejectDismiss();
        } else containTabFocus(event, event.currentTarget);
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (closeOnEscape) (onEscape ?? onClose)();
        else rejectDismiss();
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        backdropPress.current =
          !event.defaultPrevented && event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        const outside =
          !event.defaultPrevented &&
          backdropPress.current &&
          event.target === event.currentTarget;
        backdropPress.current = false;
        if (outside) {
          if (closeOnDimmerClick) (onDimmerClick ?? onClose)();
          else rejectDismiss();
        }
      }}
    >
      <div className="bibbidi-dialog-surface" ref={surfaceRef}>
        <div className="bibbidi-dialog-panel" ref={panelRef}>
          <div
            className="bibbidi-dialog-body"
            role="region"
            aria-labelledby={titleId}
          >
            <div id={titleId}>{title}</div>
            {description && (
              <div
                id={descriptionId}
                className="bibbidi-dialog-description-slot"
              >
                {description}
              </div>
            )}
            {children}
          </div>
          <div className="bibbidi-dialog-actions" ref={actionsRef}>
            {actions}
          </div>
        </div>
      </div>
    </dialog>,
    portalContainer ?? document.body,
  );
}
function Title({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      {...props}
      className={["bibbidi-dialog-title", className].filter(Boolean).join(" ")}
    >
      {children}
    </h2>
  );
}
function Description({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      {...props}
      className={["bibbidi-dialog-description", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
function AlertButton(props: ButtonProps) {
  return <Button size="large" {...props} display="block" />;
}
function CancelButton(props: ButtonProps) {
  return (
    <Button
      size="large"
      color="dark"
      variant="weak"
      {...props}
      display="block"
    />
  );
}
function ConfirmButton(props: ButtonProps) {
  return <Button size="large" {...props} display="block" />;
}
function AlertRoot({ alertButton, ...props }: AlertDialogProps) {
  return (
    <Root role="alertdialog" {...props} actions={<div>{alertButton}</div>} />
  );
}
function ConfirmRoot({
  cancelButton,
  confirmButton,
  ...props
}: ConfirmDialogProps) {
  return (
    <Root
      {...props}
      actions={
        <>
          <div>{cancelButton}</div>
          <div>{confirmButton}</div>
        </>
      }
    />
  );
}
export const AlertDialog = Object.assign(AlertRoot, {
  Title,
  Description,
  AlertButton,
});
export const ConfirmDialog = Object.assign(ConfirmRoot, {
  Title,
  Description,
  CancelButton,
  ConfirmButton,
});
export const Dialog = Object.assign(Root, {
  Title,
  Description,
  Alert: AlertDialog,
  Confirm: ConfirmDialog,
});
