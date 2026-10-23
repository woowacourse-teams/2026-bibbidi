import {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  TransitionEvent as ReactTransitionEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import "./BottomSheetDismiss.css";
import { useModalEnvironment } from "../modal/useModalEnvironment";

interface UseBottomSheetDismissOptions {
  canDismiss?: boolean;
  onDismiss: () => void;
}

interface DragState {
  dialogHeight: number;
  offset: number;
  pointerId: number;
  startY: number;
}

const CLOSE_ANIMATION_FALLBACK_MS = 280;
const MAX_DRAG_DISMISS_DISTANCE = 96;
function prefersReducedMotion() {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function useBottomSheetDismiss({
  canDismiss = true,
  onDismiss,
}: UseBottomSheetDismissOptions) {
  const [dragOffset, setDragOffset] = useState(0);
  const [dragProgress, setDragProgress] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const closeCompletedRef = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  const completeDismiss = useCallback(() => {
    if (closeCompletedRef.current) {
      return;
    }

    closeCompletedRef.current = true;
    onDismiss();
  }, [onDismiss]);

  const requestDismiss = useCallback(() => {
    if (!canDismiss || isClosing || closeCompletedRef.current) {
      return;
    }

    dragStateRef.current = null;
    setIsDragging(false);

    if (prefersReducedMotion()) {
      completeDismiss();
      return;
    }

    setIsClosing(true);
  }, [canDismiss, completeDismiss, isClosing]);
  useModalEnvironment({
    rootRef: dialogRef,
    initialFocusRef: handleRef,
    returnFocusRef,
    onEscape: requestDismiss,
  });

  useEffect(() => {
    if (!isClosing) {
      return;
    }

    const timeoutId = window.setTimeout(
      completeDismiss,
      CLOSE_ANIMATION_FALLBACK_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, [completeDismiss, isClosing]);

  const handleDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (
      !canDismiss ||
      isClosing ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStateRef.current = {
      dialogHeight: dialogRef.current?.getBoundingClientRect().height ?? 0,
      offset: 0,
      pointerId: event.pointerId,
      startY: event.clientY,
    };
    setDragOffset(0);
    setDragProgress(0);
    setIsDragging(true);
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId || isClosing) {
      return;
    }

    const nextOffset = Math.max(0, event.clientY - dragState.startY);
    dragState.offset = nextOffset;
    setDragOffset(nextOffset);
    setDragProgress(
      dragState.dialogHeight > 0
        ? Math.min(nextOffset / dragState.dialogHeight, 1)
        : 0,
    );
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragStateRef.current = null;
    setIsDragging(false);

    const dismissDistance =
      dragState.dialogHeight > 0
        ? Math.min(MAX_DRAG_DISMISS_DISTANCE, dragState.dialogHeight * 0.2)
        : MAX_DRAG_DISMISS_DISTANCE;

    if (dragState.offset >= dismissDistance) {
      requestDismiss();
      return;
    }

    setDragOffset(0);
    setDragProgress(0);
  };

  const handleDragKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    requestDismiss();
  };

  const handleTransitionEnd = (event: ReactTransitionEvent<HTMLElement>) => {
    if (
      isClosing &&
      event.target === event.currentTarget &&
      event.propertyName === "transform"
    ) {
      completeDismiss();
    }
  };

  const rootStyle = {
    "--bottom-sheet-drag-offset": `${dragOffset}px`,
    "--bottom-sheet-scrim-opacity": String(1 - dragProgress),
  } as CSSProperties;

  return {
    dialogRef,
    finishDrag,
    handleDragKeyDown,
    handleDragMove,
    handleDragStart,
    handleRef,
    handleTransitionEnd,
    isClosing,
    isDragging,
    requestDismiss,
    rootStyle,
  };
}
