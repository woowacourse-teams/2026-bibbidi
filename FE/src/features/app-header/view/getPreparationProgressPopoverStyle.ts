import type { CSSProperties } from "react";

const WIDTH = 280;
const MAX_HEIGHT = 272;
const MARGIN = 12;
const GAP = 8;

export function getPreparationProgressPopoverStyle(
  trigger: Pick<DOMRectReadOnly, "right" | "top" | "bottom">,
  contentHeight: number,
  viewport: { width: number; height: number },
): CSSProperties {
  const marginX = Math.min(MARGIN, viewport.width / 2);
  const marginY = Math.min(MARGIN, viewport.height / 2);
  const width = Math.min(WIDTH, Math.max(0, viewport.width - marginX * 2));
  const left = Math.max(
    marginX,
    Math.min(trigger.right - width, viewport.width - marginX - width),
  );
  const belowTop = Math.max(
    marginY,
    Math.min(trigger.bottom + GAP, viewport.height - marginY),
  );
  const aboveBottom = Math.max(
    marginY,
    Math.min(viewport.height - trigger.top + GAP, viewport.height - marginY),
  );
  const availableBelow = Math.max(0, viewport.height - marginY - belowTop);
  const availableAbove = Math.max(0, viewport.height - marginY - aboveBottom);
  const placeAbove =
    Math.min(contentHeight, MAX_HEIGHT) > availableBelow &&
    availableAbove > availableBelow;

  return {
    left,
    width,
    maxHeight: Math.min(
      MAX_HEIGHT,
      placeAbove ? availableAbove : availableBelow,
    ),
    ...(placeAbove ? { bottom: aboveBottom } : { top: belowTop }),
  };
}
