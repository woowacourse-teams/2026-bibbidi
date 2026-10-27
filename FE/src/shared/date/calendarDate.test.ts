import { describe, expect, it } from "vitest";
import { addMonths, dateKey, dateObject, getDateBounds } from "./calendarDate";
import { SCHEDULE_YEAR_RANGE } from "./scheduleDate";

describe("calendar date boundaries", () => {
  it.each(["0001-01-01", "0005-01-01", "0099-12-31", "9999-12-31"])(
    "%s를 연도와 시간대 변환 없이 왕복한다",
    (date) => {
      expect(dateKey(dateObject(date))).toBe(date);
    },
  );
  it("연도 범위와 날짜 제한의 교집합으로 보정한다", () => {
    const { lower, upper, clamp } = getDateBounds({
      today: "2026-10-27",
      yearRange: { start: 2020, end: 2030 },
      minDate: "2022-03-12",
      maxDate: "2029-06-15",
    });
    expect([lower, upper]).toEqual(["2022-03-12", "2029-06-15"]);
    expect(clamp("2020-01-01")).toBe(lower);
    expect(clamp("2030-12-31")).toBe(upper);
    expect(clamp("2026-10-27")).toBe("2026-10-27");
  });
  it("서비스 범위를 넘는 월 이동을 양 끝 날짜로 보정한다", () => {
    const { clamp } = getDateBounds({
      today: "2026-10-27",
      yearRange: SCHEDULE_YEAR_RANGE,
    });
    expect(clamp(addMonths("0001-01-01", -1))).toBe("0001-01-01");
    expect(clamp(addMonths("9999-12-31", 1))).toBe("9999-12-31");
  });
  it("공용 DatePicker 기본 범위는 기준 연도 전후 100년을 유지한다", () => {
    const { lower, upper } = getDateBounds({ today: "2026-10-27" });
    expect([lower, upper]).toEqual(["1926-01-01", "2126-12-31"]);
  });
});
