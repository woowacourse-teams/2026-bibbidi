import { describe, expect, it } from "vitest";

import { calculateChecklistProgress } from "./checklist";

describe("calculateChecklistProgress", () => {
  it.each([0, -1])("전체 항목이 %i개이면 진행률을 0으로 계산한다", (total) => {
    expect(calculateChecklistProgress(0, total)).toBe(0);
  });

  it.each([
    [1, 3, 33],
    [2, 3, 67],
    [2, 2, 100],
  ])("%i/%i 완료 비율을 %i로 반올림한다", (completed, total, expected) => {
    expect(calculateChecklistProgress(completed, total)).toBe(expected);
  });

  it.each([
    [-1, 3, 0],
    [4, 3, 100],
  ])("%i/%i 완료율을 %i로 제한한다", (completed, total, expected) => {
    expect(calculateChecklistProgress(completed, total)).toBe(expected);
  });
});
