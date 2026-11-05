import {
  useEffect,
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
  layerRef,
  saving,
  onSkip,
  onAdd,
}: {
  layerRef: RefObject<HTMLElement | null>;
  saving: boolean;
  onSkip: () => void;
  onAdd: () => void;
}) {
  const gesture = useRef<{
    pointerId: number;
    x: number;
    card: HTMLButtonElement;
  } | null>(null);
  const restoreScroll = useRef<(() => void) | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [bounds, setBounds] = useState<{
    card: FloatingCardBounds;
    layer: { left: number; top: number; width: number; height: number };
  } | null>(null);
  const position = getFloatingCardPosition(drag ?? 0, bounds?.card ?? null);
  const reset = () => {
    const current = gesture.current;
    gesture.current = null;
    restoreScroll.current?.();
    restoreScroll.current = null;
    layerRef.current?.hidePopover?.();
    if (current?.card.hasPointerCapture?.(current.pointerId))
      current.card.releasePointerCapture(current.pointerId);
    setDrag(null);
    setBounds(null);
  };
  useEffect(() => () => restoreScroll.current?.(), []);
  return {
    drag,
    direction: drag === null ? null : getSwipeDirection(drag),
    reset,
    slotStyle: bounds ? { height: bounds.layer.height } : undefined,
    layerStyle: {
      "--recommendation-layer-left": `${bounds?.layer.left ?? 0}px`,
      "--recommendation-layer-top": `${bounds?.layer.top ?? 0}px`,
      "--recommendation-layer-width": `${bounds?.layer.width ?? 0}px`,
    } as CSSProperties,
    cardStyle: {
      "--recommendation-x": `${position.x}px`,
      "--recommendation-rotation": `${position.rotation}deg`,
    } as CSSProperties,
    pointerHandlers: {
      onLostPointerCapture: reset,
      onPointerCancel: reset,
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.isPrimary === false || event.button !== 0 || saving) return;
        // 기본 포커스 이동으로 대화 목록이 카드 쪽으로 스크롤되는 것을 막는다.
        event.preventDefault();
        gesture.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          card: event.currentTarget,
        };
        const card = event.currentTarget;
        const layer = layerRef.current;
        const log = card.closest<HTMLElement>(".ai-chat__log");
        if (log) {
          const overflow = log.style.overflowY;
          const anchor = log.style.overflowAnchor;
          const scrollTop = log.scrollTop;
          const keepPosition = () => {
            if (log.scrollTop !== scrollTop) log.scrollTop = scrollTop;
          };
          log.style.overflowY = "hidden";
          log.style.overflowAnchor = "none";
          log.addEventListener("scroll", keepPosition);
          restoreScroll.current = () => {
            log.removeEventListener("scroll", keepPosition);
            log.style.overflowY = overflow;
            log.style.overflowAnchor = anchor;
            log.scrollTop = scrollTop;
          };
        }
        if (layer?.showPopover) {
          const { left, width, height } = card.getBoundingClientRect();
          const viewport = card.ownerDocument.documentElement;
          setBounds({
            card: {
              left,
              width,
              height,
              viewportWidth: viewport.clientWidth,
            },
            layer: layer.getBoundingClientRect(),
          });
          layer.showPopover();
        }
        card.setPointerCapture(event.pointerId);
        setDrag(0);
      },
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        const start = gesture.current;
        if (!start || event.pointerId !== start.pointerId) return;
        const dx = event.clientX - start.x;
        setDrag(Math.max(-140, Math.min(140, dx)));
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        const start = gesture.current;
        if (!start || event.pointerId !== start.pointerId) return;
        const distance = event.clientX - start.x;
        reset();
        const direction = getSwipeDirection(distance);
        if (direction === "skip") onSkip();
        if (direction === "add") onAdd();
      },
    },
  };
}
