import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from "react";

import {
  getFloatingCardPosition,
  getSwipeDirection,
  type FloatingCardBounds,
} from "../model/recommendationSwipe";

export function useRecommendationSwipe({
  cardRef,
  saving,
  onSkip,
  onAdd,
}: {
  cardRef: RefObject<HTMLButtonElement | null>;
  saving: boolean;
  onSkip: () => void;
  onAdd: () => void;
}) {
  const gesture = useRef<{ pointerId: number; x: number; y: number } | null>(
    null,
  );
  const [drag, setDrag] = useState<number | null>(null);
  const [bounds, setBounds] = useState<FloatingCardBounds | null>(null);
  const position = getFloatingCardPosition(drag ?? 0, bounds);
  const reset = () => {
    cardRef.current?.hidePopover?.();
    gesture.current = null;
    setDrag(null);
    setBounds(null);
  };
  return {
    drag,
    direction: drag === null ? null : getSwipeDirection(drag),
    reset,
    stageStyle: bounds ? { minHeight: bounds.stageHeight } : undefined,
    cardStyle: {
      "--recommendation-x": `${position.x}px`,
      "--recommendation-rotation": `${position.rotation}deg`,
      "--recommendation-left": `${bounds?.left ?? 0}px`,
      "--recommendation-top": `${position.top}px`,
      "--recommendation-width": `${bounds?.width ?? 0}px`,
      "--recommendation-height": `${bounds?.height ?? 0}px`,
    } as CSSProperties,
    pointerHandlers: {
      onLostPointerCapture: reset,
      onPointerCancel: reset,
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.isPrimary === false || event.button !== 0 || saving) return;
        gesture.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        const card = event.currentTarget;
        if (card.showPopover) {
          const { left, top, width, height } = card.getBoundingClientRect();
          const viewport = card.ownerDocument.documentElement;
          setBounds({
            left,
            top,
            width,
            height,
            viewportWidth: viewport.clientWidth,
            viewportHeight: viewport.clientHeight,
            stageHeight:
              card.parentElement?.getBoundingClientRect().height ?? height,
          });
          card.showPopover();
        }
        card.setPointerCapture(event.pointerId);
        setDrag(0);
      },
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        const start = gesture.current;
        if (!start || event.pointerId !== start.pointerId) return;
        const dx = event.clientX - start.x;
        if (Math.abs(event.clientY - start.y) > Math.max(12, Math.abs(dx))) {
          reset();
          return;
        }
        setDrag(Math.max(-140, Math.min(140, dx)));
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        const start = gesture.current;
        if (!start || event.pointerId !== start.pointerId) return;
        const distance = event.clientX - start.x;
        const vertical = event.clientY - start.y;
        reset();
        if (Math.abs(vertical) > Math.abs(distance)) return;
        const direction = getSwipeDirection(distance);
        if (direction === "skip") onSkip();
        if (direction === "add") onAdd();
      },
    },
  };
}
