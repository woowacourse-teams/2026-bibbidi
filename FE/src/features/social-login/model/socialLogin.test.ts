import { describe, expect, it } from "vitest";

import {
  isConnectedSocialProvider,
  readSocialLoginCallbackParams,
} from "./socialLogin";

describe("readSocialLoginCallbackParams", () => {
  it("돌아온 주소의 code와 state를 꺼낸다", () => {
    expect(readSocialLoginCallbackParams("?code=abc&state=xyz")).toEqual({
      status: "ready",
      code: "abc",
      state: "xyz",
    });
  });

  it("code나 state가 없으면 사용할 수 없다고 판단한다", () => {
    expect(readSocialLoginCallbackParams("?code=abc")).toEqual({
      status: "invalid",
    });
    expect(readSocialLoginCallbackParams("?state=xyz")).toEqual({
      status: "invalid",
    });
  });

  it("제공자가 오류를 돌려주면 사용할 수 없다고 판단한다", () => {
    expect(
      readSocialLoginCallbackParams("?error=access_denied&state=xyz"),
    ).toEqual({ status: "invalid" });
  });
});

describe("isConnectedSocialProvider", () => {
  it("서버와 연동한 카카오와 구글만 연결된 제공자로 본다", () => {
    expect(isConnectedSocialProvider("kakao")).toBe(true);
    expect(isConnectedSocialProvider("google")).toBe(true);
  it("서버와 연동한 카카오만 연결된 제공자로 본다", () => {
    expect(isConnectedSocialProvider("kakao")).toBe(true);
    expect(isConnectedSocialProvider("google")).toBe(false);
    expect(isConnectedSocialProvider("apple")).toBe(false);
  });
});
