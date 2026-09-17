import { describe, expect, it } from "vitest";

import {
  createLoginEvent,
  createLogoutEvent,
  createSignUpEvent,
} from "./authAnalytics";

describe("인증 Analytics 이벤트", () => {
  it("사용자 입력 없이 서비스 로그인 이벤트를 생성한다", () => {
    expect(createLoginEvent()).toEqual({
      name: "login",
      parameters: { method: "service" },
    });
  });

  it("사용자 입력 없이 서비스 회원가입 이벤트를 생성한다", () => {
    expect(createSignUpEvent()).toEqual({
      name: "sign_up",
      parameters: { method: "service" },
    });
  });

  it("식별자나 자유 형식 문자열 없이 로그아웃 이벤트를 생성한다", () => {
    expect(createLogoutEvent()).toEqual({
      name: "logout",
      parameters: {},
    });
  });
});
