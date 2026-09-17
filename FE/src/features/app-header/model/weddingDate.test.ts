import { describe, expect, it } from "vitest";

import {
  calculateDaysUntilWedding,
  formatLocalDate,
  isValidWeddingDate,
} from "./weddingDate";

describe("weddingDate", () => {
  it.each([
    ["2024-02-29", true],
    ["2023-02-29", false],
    ["1900-02-29", false],
    ["2000-02-29", true],
    ["2027-05-15", true],
    ["0000-01-01", false],
  ])("날짜 %s의 유효성을 확인한다", (date, expected) => {
    expect(isValidWeddingDate(date)).toBe(expected);
  });

  it("미래, 당일, 과거와 윤년 경계를 일수로 계산한다", () => {
    const today = new Date(2024, 1, 28, 23, 59);
    expect(calculateDaysUntilWedding("2024-02-29", today)).toBe(1);
    expect(calculateDaysUntilWedding("2024-02-28", today)).toBe(0);
    expect(calculateDaysUntilWedding("2024-02-27", today)).toBe(-1);
    expect(calculateDaysUntilWedding("2024-03-01", today)).toBe(2);
  });

  it("기기의 로컬 날짜를 사용하고 시간과 UTC 변환에 영향을 받지 않는다", () => {
    const beforeMidnight = new Date(2027, 4, 14, 23, 59);
    const afterMidnight = new Date(2027, 4, 15, 0, 1);
    expect(formatLocalDate(beforeMidnight)).toBe("2027-05-14");
    expect(calculateDaysUntilWedding("2027-05-15", beforeMidnight)).toBe(1);
    expect(calculateDaysUntilWedding("2027-05-15", afterMidnight)).toBe(0);
  });
});
