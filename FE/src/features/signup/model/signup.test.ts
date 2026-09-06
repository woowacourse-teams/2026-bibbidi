import { describe, expect, it } from "vitest";

import { isSignupFormValid, SignupFormValues } from "./signup";

describe("isSignupFormValid", () => {
  it("모든 입력값이 API 계약을 충족하면 true를 반환한다", () => {
    const values: SignupFormValues = {
      nickname: "bibbidi",
      password: "wish",
      passwordConfirm: "wish",
    };

    expect(isSignupFormValid(values)).toBe(true);
  });

  it("하나 이상의 입력값이 유효하지 않으면 false를 반환한다", () => {
    const values: SignupFormValues = {
      nickname: "bibbidi",
      password: "wish",
      passwordConfirm: "different",
    };

    expect(isSignupFormValid(values)).toBe(false);
  });
});
