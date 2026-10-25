import { describe, expect, it } from "vitest";
import { getFloatingPosition } from "./placement";

describe("floating panel placement", () => {
  it("화면 아래 공간이 부족하면 위로 뒤집고 끝 정렬을 유지한다", () => {
    const position = getFloatingPosition(
      { left: 260, right: 300, top: 250, bottom: 280, width: 40, height: 30 },
      { width: 160, height: 100 },
      "bottom-end",
      { width: 320, height: 300 },
    );
    expect(position).toMatchObject({
      left: 140,
      top: 142,
      placement: "top-end",
    });
  });

  it("오른쪽 공간이 부족하면 왼쪽으로 뒤집고 화면 안으로 보정한다", () => {
    const position = getFloatingPosition(
      { left: 260, right: 300, top: 260, bottom: 290, width: 40, height: 30 },
      { width: 160, height: 100 },
      "right-start",
      { width: 320, height: 300 },
    );
    expect(position).toMatchObject({
      left: 92,
      top: 192,
      placement: "left-start",
    });
  });

  it("양쪽 모두 좁으면 패널 높이를 사용 가능한 공간에 맞춘다", () => {
    const position = getFloatingPosition(
      { left: 0, right: 40, top: 100, bottom: 130, width: 40, height: 30 },
      { width: 160, height: 500 },
      "bottom-start",
      { width: 320, height: 300 },
    );
    expect(position).toMatchObject({ left: 8, top: 138, maxHeight: 154 });
    expect(position.top + position.maxHeight).toBe(292);
  });

  it("Popover가 요청한 간격을 유지하고 유효하지 않은 간격은 기본값으로 처리한다", () => {
    const anchor = {
      left: 100,
      right: 140,
      top: 100,
      bottom: 140,
      width: 40,
      height: 40,
    };
    const panel = { width: 100, height: 80 };
    const viewport = { width: 400, height: 400 };
    expect(getFloatingPosition(anchor, panel, "bottom", viewport, 16).top).toBe(
      156,
    );
    expect(
      getFloatingPosition(anchor, panel, "bottom", viewport, NaN).top,
    ).toBe(148);
  });
});
