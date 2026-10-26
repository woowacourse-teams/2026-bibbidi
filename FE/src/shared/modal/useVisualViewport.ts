import { useLayoutEffect } from "react";
import type { RefObject } from "react";

/** Freeze the last viewport geometry during exit; refresh it on the next open. */
export function useVisualViewport({
  active,
  rootRef,
  prefix,
}: {
  active: boolean;
  rootRef: RefObject<HTMLElement | null>;
  prefix: string;
}) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    const view = root?.ownerDocument.defaultView;
    if (!active || !root || !view) return;
    const viewport = view.visualViewport;
    let frame: number | undefined;
    const revealInput = () => {
      if (frame !== undefined) view.cancelAnimationFrame(frame);
      frame = view.requestAnimationFrame?.(() => {
        const input = root.ownerDocument.activeElement;
        if (
          input instanceof HTMLElement &&
          root.contains(input) &&
          input.matches('input, textarea, [contenteditable="true"]')
        )
          input.scrollIntoView?.({ block: "nearest" });
      });
    };
    const update = () => {
      root.style.setProperty(
        `--${prefix}-viewport-top`,
        `${viewport?.offsetTop ?? 0}px`,
      );
      root.style.setProperty(
        `--${prefix}-viewport-height`,
        `${viewport?.height ?? view.innerHeight}px`,
      );
      revealInput();
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    view.addEventListener("resize", update);
    root.addEventListener("focusin", revealInput);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      view.removeEventListener("resize", update);
      root.removeEventListener("focusin", revealInput);
      if (frame !== undefined) view.cancelAnimationFrame(frame);
    };
  }, [active, rootRef, prefix]);
}
