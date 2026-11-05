import { RefObject, useLayoutEffect } from "react";

import { EXPAND_DURATION_MS } from "../../shared/motion";

export function useFeedbackOpeningAnimation({
  containerRef,
  triggerRef,
  isOpen,
  isMobile,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  isMobile: boolean;
}) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    const trigger = triggerRef.current;
    const dialog = container?.querySelector<HTMLElement>('[role="dialog"]');

    if (
      !isOpen ||
      !container ||
      !trigger ||
      !dialog?.animate ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    dialog.style.transformOrigin = `${triggerRect.left + triggerRect.width / 2 - dialogRect.left}px ${triggerRect.top + triggerRect.height / 2 - dialogRect.top}px`;

    const options = { duration: EXPAND_DURATION_MS, easing: "ease" };
    const animation = dialog.animate(
      [
        { scale: "0.12", opacity: 0 },
        { scale: "1", opacity: 1 },
      ],
      options,
    );
    const scrim = container.querySelector<HTMLElement>(
      ".feedback-bottom-sheet__scrim",
    );
    const scrimAnimation = scrim?.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      options,
    );
    const stopOpening = () => {
      animation.cancel();
      scrimAnimation?.cancel();
    };

    // Let clicks and drag-to-dismiss take over immediately during the opening.
    container.addEventListener("pointerdown", stopOpening, { once: true });
    dialog.addEventListener("keydown", stopOpening, { once: true });

    return () => {
      stopOpening();
      container.removeEventListener("pointerdown", stopOpening);
      dialog.removeEventListener("keydown", stopOpening);
    };
  }, [containerRef, isMobile, isOpen, triggerRef]);
}
