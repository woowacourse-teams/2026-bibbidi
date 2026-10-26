import { canFocus } from "./canFocus";
import { useEffect } from "react";
import type { RefObject } from "react";

/** A layer owns focus restoration for its whole lifetime, including layout changes. */
export function useReturnFocus(
  rootRef: RefObject<HTMLElement | null>,
  returnFocusRef?: RefObject<HTMLElement | null>,
  fallbackFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const root = rootRef.current;
    const previous = returnFocusRef?.current ?? document.activeElement;
    const fallback = fallbackFocusRef?.current;
    return () => {
      queueMicrotask(() => {
        if (!root || root.isConnected) return;
        const active = document.activeElement;
        // Do not steal focus from a new screen or a deliberately selected control.
        if (
          active !== document.body &&
          active !== null &&
          !root.contains(active)
        )
          return;
        const target = canFocus(previous) ? previous : fallback;
        if (target && canFocus(target)) target.focus({ preventScroll: true });
      });
    };
  }, [rootRef, returnFocusRef, fallbackFocusRef]);
}
