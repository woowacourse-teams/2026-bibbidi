import {
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const POPOVER_WIDTH = 280;
const POPOVER_MAX_HEIGHT = 272;
const POPOVER_MARGIN = 12;
const POPOVER_GAP = 8;

export function usePreparationProgressPopover(
  onClose: () => void,
  triggerRef: RefObject<HTMLButtonElement | null>,
) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: POPOVER_MARGIN, top: 0 });
  const closeAndRestoreFocus = useCallback(() => {
    triggerRef.current?.focus();
    onClose();
  }, [onClose, triggerRef]);

  useLayoutEffect(() => {
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const left = Math.max(
        POPOVER_MARGIN,
        Math.min(
          rect.right - POPOVER_WIDTH,
          window.innerWidth - POPOVER_WIDTH - POPOVER_MARGIN,
        ),
      );
      const top = rect.bottom + POPOVER_GAP;
      setPosition((current) =>
        current.left === left && current.top === top ? current : { left, top },
      );
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [triggerRef]);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOutside = (event: Event) => {
      if (
        event.target instanceof Node &&
        !dialogRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        onClose();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestoreFocus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeAndRestoreFocus, onClose, triggerRef]);

  return {
    closeAndRestoreFocus,
    closeRef,
    dialogRef,
    style: {
      ...position,
      width: POPOVER_WIDTH,
      maxHeight: `min(${POPOVER_MAX_HEIGHT}px, calc(100dvh - ${position.top + POPOVER_MARGIN}px))`,
    },
  };
}
