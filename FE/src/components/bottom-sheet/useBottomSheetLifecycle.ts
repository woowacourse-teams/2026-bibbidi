import { useId, useLayoutEffect, useRef } from "react";
import { lockScroll } from "../../shared/scroll/lockScroll";

export function useBottomSheetLifecycle({
  open,
  hasTextField,
  onEntered,
  onExited,
}: {
  open: boolean;
  hasTextField: boolean;
  onEntered?: () => void;
  onExited?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const release = useRef<(() => void) | null>(null);
  const callbacks = useRef({ onEntered, onExited });
  const titleId = useId();
  const descriptionId = useId();
  useLayoutEffect(() => {
    callbacks.current = { onEntered, onExited };
  });
  useLayoutEffect(
    () => () => {
      release.current?.();
      release.current = null;
    },
    [],
  );
  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    let cancelled = false;
    const afterAnimation = (callback: () => void) => {
      const animations = panelRef.current?.getAnimations?.() ?? [];
      Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => {
        if (!cancelled) callback();
      });
    };
    if (open) {
      if (!dialog.open) {
        const previous = document.activeElement;
        delete dialog.dataset.state;
        dialog.showModal();
        const unlock = lockScroll(document.body);
        release.current = () => {
          dialog.close();
          unlock();
          if (previous instanceof HTMLElement && previous.isConnected)
            previous.focus({ preventScroll: true });
        };
      }
      dialog.dataset.state = "open";
      afterAnimation(() => callbacks.current.onEntered?.());
    } else if (dialog.open) {
      dialog.dataset.state = "closing";
      afterAnimation(() => {
        release.current?.();
        release.current = null;
        callbacks.current.onExited?.();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!hasTextField) return;
    const dialog = dialogRef.current!;
    const viewport = window.visualViewport;
    let frame: number | undefined;
    const revealInput = () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame?.(() => {
        const active = document.activeElement;
        if (
          dialog.open &&
          active instanceof HTMLElement &&
          dialog.contains(active) &&
          active.matches('input, textarea, [contenteditable="true"]')
        )
          active.scrollIntoView?.({ block: "nearest" });
      });
    };
    const update = () => {
      dialog.style.setProperty(
        "--bottom-sheet-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
      dialog.style.setProperty(
        "--bottom-sheet-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      revealInput();
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    dialog.addEventListener("focusin", revealInput);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      dialog.removeEventListener("focusin", revealInput);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      dialog.style.removeProperty("--bottom-sheet-viewport-top");
      dialog.style.removeProperty("--bottom-sheet-viewport-height");
    };
  }, [hasTextField]);
  return { dialogRef, panelRef, titleId, descriptionId };
}
