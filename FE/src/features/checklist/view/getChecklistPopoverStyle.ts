import { CSSProperties } from "react";

interface ChecklistPopoverPositionOptions {
  gap: number;
  margin: number;
  maxWidth: number;
}

export function getChecklistPopoverStyle(
  trigger: HTMLElement,
  popover: HTMLElement,
  { gap, margin, maxWidth }: ChecklistPopoverPositionOptions,
): CSSProperties {
  const triggerRect = trigger.getBoundingClientRect();
  const transformedBottomSheet = popover.closest<HTMLElement>(
    ".bottom-sheet-dismiss__dialog",
  );
  const containingRect = transformedBottomSheet?.getBoundingClientRect();
  const boundaryLeft = Math.max(margin, (containingRect?.left ?? 0) + margin);
  const boundaryRight = Math.min(
    window.innerWidth - margin,
    (containingRect?.right ?? window.innerWidth) - margin,
  );
  const boundaryTop = Math.max(margin, (containingRect?.top ?? 0) + margin);
  const boundaryBottom = Math.min(
    window.innerHeight - margin,
    (containingRect?.bottom ?? window.innerHeight) - margin,
  );
  const width = Math.min(maxWidth, Math.max(0, boundaryRight - boundaryLeft));
  const left = Math.min(
    Math.max(boundaryLeft, triggerRect.right - width),
    boundaryRight - width,
  );
  const availableBelow = Math.max(0, boundaryBottom - triggerRect.bottom - gap);
  const availableAbove = Math.max(0, triggerRect.top - gap - boundaryTop);
  const naturalHeight = popover.scrollHeight;
  const placeAbove =
    naturalHeight > availableBelow && availableAbove > availableBelow;
  const maxHeight = placeAbove ? availableAbove : availableBelow;
  const renderedHeight = Math.min(naturalHeight, maxHeight);
  const top = placeAbove
    ? triggerRect.top - gap - renderedHeight
    : triggerRect.bottom + gap;

  return {
    left: left - (containingRect?.left ?? 0),
    maxHeight,
    top: top - (containingRect?.top ?? 0),
    width,
  };
}
