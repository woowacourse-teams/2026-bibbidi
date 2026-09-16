import { describe, expect, it } from "vitest";

import {
  calculatePreparationProgress,
  createAppHeaderSummaryModel,
} from "./appHeaderSummary";

describe("AppHeaderSummaryModel", () => {
  it("체크리스트의 완료 항목 수와 전체 항목 수를 계산한다", () => {
    expect(
      createAppHeaderSummaryModel([
        { status: "done" },
        { status: "continue" },
        { status: "prev" },
        { status: "done" },
      ]),
    ).toEqual({
      completedTaskCount: 2,
      totalTaskCount: 4,
      weddingDate: { status: "unset" },
    });
  });

  it("전체 항목이 없으면 완료율을 0으로 계산한다", () => {
    expect(calculatePreparationProgress(0, 0)).toBe(0);
  });

  it.each([
    [1, 3, 33],
    [2, 3, 67],
  ])("%i/%i 비율을 %i로 반올림한다", (completed, total, expected) => {
    expect(calculatePreparationProgress(completed, total)).toBe(expected);
  });

  it.each([
    [-1, 3, 0],
    [4, 3, 100],
  ])("%i/%i 완료율을 %i로 제한한다", (completed, total, expected) => {
    expect(calculatePreparationProgress(completed, total)).toBe(expected);
  });
});
