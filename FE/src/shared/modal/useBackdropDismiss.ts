import { useRef } from "react";
import type { MouseEventHandler, PointerEventHandler } from "react";

type BackdropHandlers = {
  onPointerDown?: PointerEventHandler<HTMLDialogElement>;
  onPointerUp?: PointerEventHandler<HTMLDialogElement>;
  onPointerCancel?: PointerEventHandler<HTMLDialogElement>;
  onClick?: MouseEventHandler<HTMLDialogElement>;
};

/** Consume a complete backdrop click before the owner can remove the modal. */
export function useBackdropDismiss({
  onDismiss,
  ...handlers
}: BackdropHandlers & { onDismiss: () => void }) {
  const gesture = useRef<"idle" | "pressed" | "released">("idle");
  return {
    onPointerDown(event) {
      handlers.onPointerDown?.(event);
      gesture.current =
        !event.defaultPrevented &&
        event.button === 0 &&
        event.isPrimary !== false &&
        event.target === event.currentTarget
          ? "pressed"
          : "idle";
    },
    onPointerUp(event) {
      handlers.onPointerUp?.(event);
      gesture.current =
        gesture.current === "pressed" &&
        !event.defaultPrevented &&
        event.target === event.currentTarget
          ? "released"
          : "idle";
    },
    onPointerCancel(event) {
      handlers.onPointerCancel?.(event);
      gesture.current = "idle";
    },
    onClick(event) {
      handlers.onClick?.(event);
      const outside =
        gesture.current === "released" &&
        !event.defaultPrevented &&
        event.target === event.currentTarget;
      gesture.current = "idle";
      if (!outside) return;
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
    },
  } satisfies Required<BackdropHandlers>;
}
