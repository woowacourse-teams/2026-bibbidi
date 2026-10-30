import { useId, useRef } from "react";
import type { RefObject } from "react";
import { useNativeModalLifecycle } from "../../shared/modal/useNativeModalLifecycle";
import { useVisualViewport } from "../../shared/modal/useVisualViewport";

export function useBottomSheetLifecycle({
  open,
  hasTextField,
  scrollContainer,
  returnFocusRef,
  onEntered,
  onExited,
}: {
  open: boolean;
  hasTextField: boolean;
  scrollContainer?: HTMLElement | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onEntered?: () => void;
  onExited?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useNativeModalLifecycle({
    open,
    priority: 1,
    dialogRef,
    surfaceRef: panelRef,
    scrollContainer,
    returnFocusRef,
    onEntered,
    onExited,
    motionPrefix: "bottom-sheet",
  });
  useVisualViewport({
    active: open && hasTextField,
    rootRef: dialogRef,
    prefix: "bottom-sheet",
  });
  return { dialogRef, panelRef, titleId, descriptionId };
}
