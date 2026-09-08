import { useEffect, useEffectEvent, useRef, type RefObject } from "react";

interface UsePreparationBottomSheetModalOptions {
  dialogRef: RefObject<HTMLElement | null>;
  initialFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

const FOCUSABLE_ELEMENT_SELECTOR =
  'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function usePreparationBottomSheetModal({
  dialogRef,
  initialFocusRef,
  onClose,
}: UsePreparationBottomSheetModalOptions) {
  const handleClose = useEffectEvent(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  useEffect(() => {
    const returnFocusElement = returnFocusRef.current;
    const scrollContainer = document.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    );
    const previousBodyOverflow = document.body.style.overflow;
    const previousContainerOverflow = scrollContainer?.style.overflow;

    document.body.style.overflow = "hidden";
    if (scrollContainer) {
      scrollContainer.style.overflow = "hidden";
    }
    initialFocusRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          FOCUSABLE_ELEMENT_SELECTOR,
        ) ?? [],
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (scrollContainer) {
        scrollContainer.style.overflow = previousContainerOverflow ?? "";
      }
      returnFocusElement?.focus({ preventScroll: true });
    };
  }, [dialogRef, initialFocusRef]);
}
