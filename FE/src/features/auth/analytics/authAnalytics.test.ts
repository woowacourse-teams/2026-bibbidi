import { describe, expect, it } from "vitest";

import { createLogoutEvent } from "./authAnalytics";

describe("인증 Analytics 이벤트", () => {
  it("식별자나 자유 형식 문자열 없이 로그아웃 이벤트를 생성한다", () => {
    expect(createLogoutEvent()).toEqual({
      name: "logout",
      parameters: {},
    });
  });
});
