export type PopoverPlacement =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-start"
  | "top-end"
  | "bottom-start"
  | "bottom-end"
  | "left-start"
  | "left-end"
  | "right-start"
  | "right-end";

type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

/** Flip to the roomier side, then constrain the panel to an 8px viewport inset. */
export function getPopoverPosition(
  anchor: Rect,
  panel: { width: number; height: number },
  placement: PopoverPlacement,
  viewport: { width: number; height: number },
  offset = 8,
) {
  const edge = 8;
  const gap = Number.isFinite(offset) ? Math.max(0, offset) : 8;
  const [preferred, align] = placement.split("-");
  const opposite = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  } as const;
  const space = {
    top: anchor.top - gap - edge,
    bottom: viewport.height - anchor.bottom - gap - edge,
    left: anchor.left - gap - edge,
    right: viewport.width - anchor.right - gap - edge,
  };
  let side = preferred as keyof typeof opposite;
  const needed =
    side === "top" || side === "bottom" ? panel.height : panel.width;
  if (space[side] < needed && space[opposite[side]] > space[side])
    side = opposite[side];
  const vertical = side === "top" || side === "bottom";
  const maxHeight = Math.max(
    0,
    vertical ? space[side] : viewport.height - 2 * edge,
  );
  const height = Math.min(panel.height, maxHeight);
  let left = vertical
    ? align === "start"
      ? anchor.left
      : align === "end"
        ? anchor.right - panel.width
        : anchor.left + (anchor.width - panel.width) / 2
    : side === "right"
      ? anchor.right + gap
      : anchor.left - panel.width - gap;
  let top = !vertical
    ? align === "start"
      ? anchor.top
      : align === "end"
        ? anchor.bottom - height
        : anchor.top + (anchor.height - height) / 2
    : side === "bottom"
      ? anchor.bottom + gap
      : anchor.top - height - gap;
  left = Math.max(edge, Math.min(left, viewport.width - panel.width - edge));
  top = Math.max(edge, Math.min(top, viewport.height - height - edge));
  return {
    left,
    top,
    maxHeight,
    placement: `${side}${align ? `-${align}` : ""}` as PopoverPlacement,
  };
}
