import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { showLayer } from "./nativeModalStack";
import { canFocus } from "../focus/canFocus";
import { focusFirstElement } from "../focus/containTabFocus";
import { lockScroll } from "../scroll/lockScroll";

type Options = {
  open: boolean;
  dialogRef: RefObject<HTMLDialogElement | null>;
  surfaceRef: RefObject<HTMLElement | null>;
  portalContainer?: HTMLElement | null;
  scrollContainer?: HTMLElement | null;
  initialFocusRef?: RefObject<HTMLElement | null>;
  getInitialFocus?: () => HTMLElement | null | undefined;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
  motionPrefix?: string;
  priority?: number;
  deferContents?: boolean;
  onEntered?: () => void;
  onExited?: () => void;
};

/** Own native modal presence, scroll locks, animation completion and focus. */
export function useNativeModalLifecycle({
  open,
  dialogRef,
  surfaceRef,
  portalContainer,
  scrollContainer,
  motionPrefix,
  priority = 0,
  deferContents = false,
  ...options
}: Options) {
  const [ready, setReady] = useState(false);
  const [present, setPresent] = useState(false);
  const release = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const callbacks = useRef(options);
  useLayoutEffect(() => {
    callbacks.current = options;
  });
  useLayoutEffect(
    () => () => {
      release.current?.();
      release.current = null;
    },
    [portalContainer],
  );

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    let cancelled = false;
    const afterAnimation = (callback: () => void) => {
      const animations = [
        ...(surfaceRef.current?.getAnimations?.() ?? []),
        ...(dialog.getAnimations?.() ?? []),
      ];
      Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => {
        if (!cancelled) callback();
      });
    };
    if (open) {
      if (!dialog.open) {
        const previous =
          callbacks.current.returnFocusRef?.current ??
          dialog.ownerDocument.activeElement;
        const version = ++generation.current;
        delete dialog.dataset.state;
        const closeLayer = showLayer(dialog, priority);
        setReady(true);
        setPresent(true);
        const unlocks = [lockScroll(dialog.ownerDocument.body)];
        release.current = () => {
          closeLayer();
          unlocks.reverse().forEach((unlock) => unlock());
          queueMicrotask(() => {
            if (
              callbacks.current.restoreFocus === false ||
              generation.current !== version ||
              dialog.open
            )
              return;
            const target = canFocus(previous)
              ? previous
              : callbacks.current.fallbackFocusRef?.current;
            if (canFocus(target)) target.focus({ preventScroll: true });
          });
        };
      }
      if (motionPrefix && surfaceRef.current) {
        if (dialog.dataset.state === "closing")
          surfaceRef.current.style.setProperty(
            `--${motionPrefix}-enter-transform`,
            getComputedStyle(surfaceRef.current).transform,
          );
        else
          surfaceRef.current.style.removeProperty(
            `--${motionPrefix}-enter-transform`,
          );
      }
      dialog.dataset.state = "open";
      afterAnimation(() => callbacks.current.onEntered?.());
    } else if (dialog.open) {
      if (motionPrefix && surfaceRef.current)
        surfaceRef.current.style.setProperty(
          `--${motionPrefix}-exit-transform`,
          getComputedStyle(surfaceRef.current).transform,
        );
      dialog.dataset.state = "closing";
      afterAnimation(() => {
        release.current?.();
        release.current = null;
        setPresent(false);
        callbacks.current.onExited?.();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [open, dialogRef, surfaceRef, portalContainer, motionPrefix, priority]);

  useLayoutEffect(() => {
    if (
      !present ||
      !scrollContainer ||
      scrollContainer === dialogRef.current?.ownerDocument.body
    )
      return;
    return lockScroll(scrollContainer);
  }, [present, scrollContainer, dialogRef]);

  const contentsReady = !deferContents || ready;
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !contentsReady || !dialog?.open) return;
    const active = dialog.ownerDocument.activeElement;
    const activeDialog =
      active instanceof HTMLElement ? active.closest("dialog[open]") : null;
    if (activeDialog && activeDialog !== dialog) return;
    const initial =
      callbacks.current.initialFocusRef?.current ??
      callbacks.current.getInitialFocus?.();
    if (initial && dialog.contains(initial) && canFocus(initial))
      initial.focus({ preventScroll: true });
    else {
      if (active !== dialog && dialog.contains(active)) return;
      focusFirstElement(dialog);
      if (!dialog.contains(dialog.ownerDocument.activeElement))
        dialog.focus({ preventScroll: true });
    }
  }, [open, contentsReady, dialogRef, portalContainer]);
  return ready;
}
