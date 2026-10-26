import { useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";

const interactiveSelector =
  'button, a[href], input, textarea, select, label, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="slider"], [role="listbox"], [role="grid"], [role="combobox"], [role="menu"], [data-bottom-sheet-no-drag]';

type Gesture = {
  id: number;
  source: "pointer" | "touch";
  startX: number;
  startY: number;
  offset: number;
  height: number;
  active: boolean;
  ancestors: HTMLElement[];
};

/** Share one gesture policy between mouse/pen pointers and native touch scrolling. */
export function useBottomSheetDrag({
  panelRef,
  enabled,
  disableChildrenDragging,
  onDismiss,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  disableChildrenDragging: boolean;
  onDismiss: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    if (enabled) setOffset(0);
  }
  const gesture = useRef<Gesture | null>(null);
  const dismiss = useRef(onDismiss);
  const enabledRef = useRef(enabled);
  useLayoutEffect(() => {
    dismiss.current = onDismiss;
    enabledRef.current = enabled;
  });

  function begin(
    target: EventTarget | null,
    id: number,
    source: Gesture["source"],
    x: number,
    y: number,
  ) {
    const panel = panelRef.current;
    if (
      !enabled ||
      !panel ||
      !(target instanceof Element) ||
      !panel.contains(target)
    )
      return;
    const handle = target.closest(".bibbidi-bottom-sheet-handle");
    if (
      (disableChildrenDragging && !handle) ||
      (!handle && target.closest(interactiveSelector))
    )
      return;
    const ancestors: HTMLElement[] = [];
    for (
      let node: Element | null = target;
      node && node !== panel;
      node = node.parentElement
    ) {
      if (node instanceof HTMLElement) ancestors.push(node);
    }
    // A gesture that starts in scrolled content belongs to that content until released.
    if (ancestors.some((node) => node.scrollTop > 0)) return;
    gesture.current = {
      id,
      source,
      startX: x,
      startY: y,
      offset: 0,
      height: panel.getBoundingClientRect().height,
      active: false,
      ancestors,
    };
  }
  function move(
    id: number,
    source: Gesture["source"],
    x: number,
    y: number,
    preventDefault: () => void,
  ) {
    const current = gesture.current;
    if (!current || current.id !== id || current.source !== source) return;
    const dy = y - current.startY;
    const dx = Math.abs(x - current.startX);
    if (!current.active) {
      if (
        dy < -6 ||
        (dx > 6 && dx > dy) ||
        current.ancestors.some((node) => node.scrollTop > 0)
      ) {
        gesture.current = null;
        return;
      }
      if (dy < 6) return;
      current.active = true;
      if (source === "pointer") panelRef.current?.setPointerCapture?.(id);
    }
    preventDefault();
    current.offset = Math.max(0, dy);
    setOffset(current.offset);
  }
  function finish(id: number, source: Gesture["source"], cancelled = false) {
    const current = gesture.current;
    if (!current || current.id !== id || current.source !== source) return;
    gesture.current = null;
    const panel = panelRef.current;
    if (source === "pointer" && panel?.hasPointerCapture?.(id))
      panel.releasePointerCapture(id);
    const threshold =
      current.height > 0 ? Math.min(96, current.height * 0.2) : 96;
    if (!cancelled && current.active && current.offset >= threshold) {
      dismiss.current();
      // A controlled owner can decline the close request. Restore the drag then.
      queueMicrotask(() => {
        if (enabledRef.current) setOffset(0);
      });
      return;
    }
    setOffset(0);
  }

  // React touch listeners are passive. A native non-passive move listener can claim
  // a downward pull at the top without disabling native scrolling in nested widgets.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!enabled || !panel) return;
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        gesture.current = null;
        setOffset(0);
        return;
      }
      const touch = event.touches[0];
      begin(
        event.target,
        touch.identifier,
        "touch",
        touch.clientX,
        touch.clientY,
      );
    };
    const update = (event: TouchEvent) => {
      const current = gesture.current;
      if (!current || current.source !== "touch") return;
      if (event.touches.length !== 1 || !event.cancelable) {
        finish(current.id, "touch", true);
        return;
      }
      const touch = event.touches[0];
      move(touch.identifier, "touch", touch.clientX, touch.clientY, () =>
        event.preventDefault(),
      );
    };
    const end = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches))
        finish(touch.identifier, "touch", event.type === "touchcancel");
    };
    panel.addEventListener("touchstart", start, {
      passive: true,
      capture: true,
    });
    panel.addEventListener("touchmove", update, {
      passive: false,
      capture: true,
    });
    panel.addEventListener("touchend", end, true);
    panel.addEventListener("touchcancel", end, true);
    return () => {
      panel.removeEventListener("touchstart", start, true);
      panel.removeEventListener("touchmove", update, true);
      panel.removeEventListener("touchend", end, true);
      panel.removeEventListener("touchcancel", end, true);
      gesture.current = null;
    };
    // The listeners share the current policy only when these options change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, disableChildrenDragging, panelRef]);

  return {
    offset,
    onPointerDown(event: PointerEvent<HTMLDialogElement>) {
      if (
        event.pointerType === "touch" ||
        event.defaultPrevented ||
        (event.pointerType === "mouse" && event.button !== 0)
      )
        return;
      begin(
        event.target,
        event.pointerId,
        "pointer",
        event.clientX,
        event.clientY,
      );
    },
    onPointerMove(event: PointerEvent<HTMLDialogElement>) {
      if (!event.defaultPrevented)
        move(event.pointerId, "pointer", event.clientX, event.clientY, () =>
          event.preventDefault(),
        );
    },
    onPointerUp(event: PointerEvent<HTMLDialogElement>) {
      finish(event.pointerId, "pointer");
    },
    onPointerCancel(event: PointerEvent<HTMLDialogElement>) {
      finish(event.pointerId, "pointer", true);
    },
  };
}
