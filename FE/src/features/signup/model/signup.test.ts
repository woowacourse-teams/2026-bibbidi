import { describe, expect, it } from "vitest";

import {
  isSignupFormValid,
  SIGNUP_NICKNAME_MAX_LENGTH,
  SIGNUP_PASSWORD_MAX_LENGTH,
  SIGNUP_PASSWORD_MIN_LENGTH,
  SignupFormValues,
} from "./signup";

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

  it.each([
    [SIGNUP_NICKNAME_MAX_LENGTH, true],
    [SIGNUP_NICKNAME_MAX_LENGTH + 1, false],
  ])(
    "닉네임이 %i자일 때 유효성 결과로 %s를 반환한다",
    (nicknameLength, expected) => {
      const values: SignupFormValues = {
        nickname: "a".repeat(nicknameLength),
        password: "wish",
        passwordConfirm: "wish",
      };

      expect(isSignupFormValid(values)).toBe(expected);
    },
  );

  it.each([
    [SIGNUP_PASSWORD_MIN_LENGTH - 1, false],
    [SIGNUP_PASSWORD_MAX_LENGTH, true],
    [SIGNUP_PASSWORD_MAX_LENGTH + 1, false],
  ])(
    "비밀번호가 %i자일 때 유효성 결과로 %s를 반환한다",
    (passwordLength, expected) => {
      const password = "a".repeat(passwordLength);
      const values: SignupFormValues = {
        nickname: "bibbidi",
        password,
        passwordConfirm: password,
      };

      expect(isSignupFormValid(values)).toBe(expected);
    },
  );
});
