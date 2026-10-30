import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import { useViewportMetrics, viewportStyles } from "../viewport";

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
  const viewport = useViewportMetrics(active);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!active || !root) return;
    for (const [name, value] of Object.entries(
      viewportStyles(viewport, prefix),
    )) {
      root.style.setProperty(name, String(value));
    }
  }, [active, rootRef, prefix, viewport]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const view = root?.ownerDocument.defaultView;
    if (!active || !root || !view) return;
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
    revealInput();
    root.addEventListener("focusin", revealInput);
    return () => {
      root.removeEventListener("focusin", revealInput);
      if (frame !== undefined) view.cancelAnimationFrame(frame);
    };
  }, [active, rootRef, viewport]);
}
