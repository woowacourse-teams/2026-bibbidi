import { describe, expect, it } from "vitest";

import { getPreparationProgressPopoverStyle } from "./getPreparationProgressPopoverStyle";

describe("getPreparationProgressPopoverStyle", () => {
  it("아래 공간이 충분하면 버튼 아래 8px에 표시한다", () => {
    expect(
      getPreparationProgressPopoverStyle(
        { right: 306, top: 14, bottom: 50 },
        253,
        { width: 390, height: 640 },
      ),
    ).toEqual({ left: 26, top: 58, width: 280, maxHeight: 272 });
  });

  it("짧은 목록이 아래에 들어가면 위 공간이 더 넓어도 아래 배치를 유지한다", () => {
    expect(
      getPreparationProgressPopoverStyle(
        { right: 306, top: 320, bottom: 356 },
        160,
        { width: 390, height: 640 },
      ).top,
    ).toBe(364);
  });

  it("아래 공간이 부족하면 버튼 위 8px를 기준으로 자동 높이를 유지한다", () => {
    expect(
      getPreparationProgressPopoverStyle(
        { right: 306, top: 550, bottom: 590 },
        253,
        { width: 390, height: 640 },
      ),
    ).toEqual({ left: 26, bottom: 98, width: 280, maxHeight: 272 });
  });

  it.each([
    [150, 190, { top: 198, maxHeight: 150 }],
    [190, 230, { bottom: 178, maxHeight: 170 }],
  ])(
    "양쪽이 부족하면 더 넓은 쪽에 높이를 제한한다: 버튼 top %i",
    (top, bottom, expected) => {
      expect(
        getPreparationProgressPopoverStyle({ right: 306, top, bottom }, 253, {
          width: 390,
          height: 360,
        }),
      ).toMatchObject(expected);
    },
  );

  it.each([
    [-100, -60, { top: 12 }],
    [700, 744, { bottom: 12 }],
  ])(
    "버튼이 화면 밖에 있어도 화면 안으로 보정한다: 버튼 top %i",
    (top, bottom, expected) => {
      expect(
        getPreparationProgressPopoverStyle({ right: 306, top, bottom }, 253, {
          width: 390,
          height: 640,
        }),
      ).toMatchObject({ ...expected, maxHeight: 272 });
    },
  );

  it("좁고 낮은 화면에서도 너비와 최대 높이가 음수가 되지 않는다", () => {
    expect(
      getPreparationProgressPopoverStyle(
        { right: 306, top: 550, bottom: 590 },
        253,
        { width: 20, height: 10 },
      ),
    ).toMatchObject({ left: 10, width: 0, maxHeight: 0 });
  });
});
