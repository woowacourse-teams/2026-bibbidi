import { describe, expect, it } from "vitest";

import {
  createLoginPath,
  getSafeLoginReturnPath,
  PLANNER_RETURN_PATH,
} from "./loginReturnPath";

describe("loginReturnPath", () => {
  it("플래너 복귀 경로를 로그인 URL로 직렬화한다", () => {
    expect(createLoginPath(PLANNER_RETURN_PATH)).toBe(
      "/login?returnTo=%2Fplanner",
    );
  });

  it("허용한 내부 플래너 경로만 복귀 경로로 사용한다", () => {
    expect(getSafeLoginReturnPath("?returnTo=%2Fplanner")).toBe("/planner");
    expect(getSafeLoginReturnPath("?returnTo=https%3A%2F%2Fevil.example")).toBe(
      null,
    );
    expect(getSafeLoginReturnPath("?returnTo=%2Fchecklist")).toBe(null);
    expect(getSafeLoginReturnPath("?returnTo=%2F%2Fevil.example")).toBe(null);
    expect(getSafeLoginReturnPath("")).toBe(null);
  });
});
