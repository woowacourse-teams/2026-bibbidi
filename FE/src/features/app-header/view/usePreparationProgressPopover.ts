import {
  CSSProperties,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { getPreparationProgressPopoverStyle } from "./getPreparationProgressPopoverStyle";

export function usePreparationProgressPopover(
  onClose: () => void,
  triggerRef: RefObject<HTMLButtonElement | null>,
) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>(() =>
    getPreparationProgressPopoverStyle({ right: 0, top: 0, bottom: 0 }, 0, {
      width: window.innerWidth,
      height: window.innerHeight,
    }),
  );
  const closeAndRestoreFocus = useCallback(() => {
    triggerRef.current?.focus();
    onClose();
  }, [onClose, triggerRef]);

  useLayoutEffect(() => {
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const dialog = dialogRef.current;
      if (!trigger || !dialog) {
        return;
      }

      const list = listRef.current;
      // 높이가 제한된 상태에서도 잘린 내용까지 포함해 필요한 높이를 구한다.
      const contentHeight =
        dialog.getBoundingClientRect().height +
        Math.max(0, dialog.scrollHeight - dialog.clientHeight) +
        (list ? Math.max(0, list.scrollHeight - list.clientHeight) : 0);
      const nextStyle = getPreparationProgressPopoverStyle(
        trigger.getBoundingClientRect(),
        contentHeight,
        { width: window.innerWidth, height: window.innerHeight },
      );
      setStyle((current) =>
        current.left === nextStyle.left &&
        current.top === nextStyle.top &&
        current.bottom === nextStyle.bottom &&
        current.width === nextStyle.width &&
        current.maxHeight === nextStyle.maxHeight
          ? current
          : nextStyle,
      );
    };
    updatePosition();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(updatePosition);
    if (dialogRef.current) observer?.observe(dialogRef.current);
    if (listRef.current?.firstElementChild)
      observer?.observe(listRef.current.firstElementChild);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      observer?.disconnect();
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
    listRef,
    style,
  };
}
