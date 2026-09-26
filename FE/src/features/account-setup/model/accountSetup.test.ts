import { describe, expect, it } from "vitest";

import {
  toAccountSetupNickname,
  validateAccountSetupNickname,
} from "./accountSetup";

describe("accountSetup", () => {
  it("공백이거나 10자를 넘는 닉네임을 거절한다", () => {
    expect(validateAccountSetupNickname("   ")).toBe("닉네임을 입력해 주세요.");
    expect(validateAccountSetupNickname("12345678901")).toBe(
      "닉네임은 10자 이하로 입력해 주세요.",
    );
    expect(validateAccountSetupNickname(" 비비디 ")).toBeUndefined();
  });

  it("API에 보낼 닉네임의 앞뒤 공백을 제거한다", () => {
    expect(toAccountSetupNickname(" 비비디 ")).toBe("비비디");
  });
});
