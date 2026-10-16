import { describe, expect, it } from "vitest";
import {
  getFloatingCardPosition,
  getSwipeDirection,
  type FloatingCardBounds,
} from "./recommendationSwipe";

const bounds: FloatingCardBounds = {
  left: 20,
  width: 280,
  height: 272,
  viewportWidth: 360,
};

describe("추천 카드 스와이프 경계", () => {
  it("판정 기준 미만은 복귀하고 기준부터 좌우 동작을 적용한다", () => {
    expect(getSwipeDirection(-69)).toBeNull();
    expect(getSwipeDirection(69)).toBeNull();
    expect(getSwipeDirection(-70)).toBe("skip");
    expect(getSwipeDirection(70)).toBe("add");
  });

  it.each([-140, 140])(
    "%s px로 이동해도 회전한 카드의 좌우 경계를 지킨다",
    (drag) => {
      const position = getFloatingCardPosition(drag, bounds);
      const angle = (Math.abs(position.rotation) * Math.PI) / 180;
      const rotatedWidth =
        bounds.width * Math.cos(angle) + bounds.height * Math.sin(angle);
      const centerX = bounds.left + position.x + bounds.width / 2;
      expect(centerX - rotatedWidth / 2).toBeGreaterThanOrEqual(8 - 1e-8);
      expect(centerX + rotatedWidth / 2).toBeLessThanOrEqual(
        bounds.viewportWidth - 8 + 1e-8,
      );
      // 화면 안으로 이동을 제한해도 사용자의 실제 이동은 추가·스킵으로 판정한다.
      expect(getSwipeDirection(drag)).toBe(drag < 0 ? "skip" : "add");
    },
  );
});
