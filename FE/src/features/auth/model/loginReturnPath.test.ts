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
  it("선택한 항목을 보존하되 임의 주소나 추가 파라미터를 허용하지 않는다", () => {
    expect(
      getSafeLoginReturnPath("?returnTo=%2Fcalendar%3FdateFor%3D101"),
    ).toBe("/calendar?dateFor=101");
    expect(
      getSafeLoginReturnPath("?returnTo=%2Fcalendar%3FdateFor%3D-1"),
    ).toBeNull();
    expect(
      getSafeLoginReturnPath(
        "?returnTo=%2Fcalendar%3FdateFor%3D101%26redirect%3Dhttps%3A%2F%2Fevil.example",
      ),
    ).toBeNull();
  });
});
