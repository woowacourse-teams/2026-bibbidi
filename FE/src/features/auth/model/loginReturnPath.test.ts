import { describe, expect, it } from "vitest";

import { getSafeLoginReturnPath } from "./loginReturnPath";

describe("loginReturnPath", () => {
  it("허용한 내부 캘린더 경로만 복귀 경로로 사용한다", () => {
    expect(getSafeLoginReturnPath("?returnTo=%2Fcalendar")).toBe("/calendar");
    expect(getSafeLoginReturnPath("?returnTo=%2Fplanner")).toBe(null);
    expect(getSafeLoginReturnPath("?returnTo=https%3A%2F%2Fevil.example")).toBe(
      null,
    );
    expect(getSafeLoginReturnPath("?returnTo=%2Fchecklist")).toBe(null);
    expect(getSafeLoginReturnPath("?returnTo=%2F%2Fevil.example")).toBe(null);
    expect(getSafeLoginReturnPath("")).toBe(null);
  });
});
