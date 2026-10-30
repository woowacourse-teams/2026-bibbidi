import { describe, expect, it } from "vitest";
import { lockScroll } from "./lockScroll";

describe("공유 스크롤 잠금", () => {
  it("마지막 모달이 닫힐 때 기존 스크롤과 overscroll 설정을 복원한다", () => {
    const element = document.createElement("div");
    element.style.overflow = "auto";
    element.style.overscrollBehaviorY = "auto";
    element.scrollTop = 320;
    const releaseParent = lockScroll(element);
    const releaseChild = lockScroll(element);
    expect(element.style.overflow).toBe("hidden");
    expect(element.style.overscrollBehaviorY).toBe("contain");
    releaseParent();
    expect(element.style.overflow).toBe("hidden");
    expect(element.style.overscrollBehaviorY).toBe("contain");
    releaseChild();
    expect(element.style.overflow).toBe("auto");
    expect(element.style.overscrollBehaviorY).toBe("auto");
    expect(element.scrollTop).toBe(320);
  });
});
