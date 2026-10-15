export const RECOMMENDATION_SWIPE_THRESHOLD = 70;

export interface FloatingCardBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  stageHeight: number;
}

export function getSwipeDirection(distance: number) {
  return Math.abs(distance) >= RECOMMENDATION_SWIPE_THRESHOLD
    ? distance < 0
      ? "skip"
      : "add"
    : null;
}

export function getFloatingCardPosition(
  drag: number,
  bounds: FloatingCardBounds | null,
) {
  const rotation = Math.max(-6, Math.min(6, drag / 12));
  if (!bounds) return { x: drag, top: 0, rotation };
  const { left, top, width, height, viewportWidth, viewportHeight } = bounds;
  const radians = (Math.abs(rotation) * Math.PI) / 180;
  const extraX =
    (width * Math.cos(radians) + height * Math.sin(radians) - width) / 2;
  const extraY =
    (height * Math.cos(radians) + width * Math.sin(radians) - height) / 2;
  // 회전한 모서리까지 화면 안에 두되, 동작 판정은 실제 손가락 이동량을 쓴다.
  return {
    x: Math.max(
      8 + extraX - left,
      Math.min(drag, viewportWidth - left - width - extraX - 8),
    ),
    top: Math.max(
      8 + extraY,
      Math.min(top, viewportHeight - height - extraY - 8),
    ),
    rotation,
  };
}
