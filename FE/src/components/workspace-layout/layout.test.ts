import { describe, expect, it } from "vitest";
import { getWorkspaceLayout } from "./layout";

const metrics = {
  md: 768,
  lg: 1280,
  xl: 1440,
  category: 176,
  detail: 400,
  mainMin: 560,
  gutter: 24,
};
const layout = (
  viewport: number,
  available: number,
  navigation = true,
  aside = true,
) => getWorkspaceLayout(viewport, available, navigation, aside, metrics);

describe("Workspace 배치", () => {
  it("중단점과 실제 본문 최소 너비를 모두 확보해야 패널을 병렬 배치한다", () => {
    expect(layout(1279, 1280).asidePlacement).toBe("overlay");
    expect(layout(1280, 983.99).asidePlacement).toBe("overlay");
    expect(layout(1280, 984).asidePlacement).toBe("docked");
    expect(layout(1439, 1280).navigationPlacement).toBe("top");
    expect(layout(1440, 1184)).toMatchObject({
      navigationPlacement: "side",
      asidePlacement: "docked",
    });
    expect(layout(1440, 1183.99).asidePlacement).toBe("overlay");
  });
  it("넓은 뷰포트의 좁은 부모와 생략한 영역을 처리한다", () => {
    expect(layout(1600, 560)).toMatchObject({
      navigationPlacement: "top",
      asidePlacement: "overlay",
    });
    expect(layout(1440, 984, false).asidePlacement).toBe("docked");
    expect(layout(1440, 1280, true, false).asidePlacement).toBe("overlay");
    expect(layout(767, 1280).isMobile).toBe(true);
    expect(layout(768, 1280).isMobile).toBe(false);
  });
});
