import { describe, expect, it } from "vitest";

import {
  createRequiredTermsContract,
  validateOnboardingNickname,
} from "./onboarding";

function term(id: number, version: string, required = true) {
  return {
    id,
    code: `terms-${id}`,
    version,
    title: `약관 ${id}`,
    content: `약관 ${id} 전문`,
    required,
  };
}

describe("createRequiredTermsContract", () => {
  it("필수 약관만 고르고 하나의 공통 버전을 반환한다", () => {
    expect(
      createRequiredTermsContract([
        term(1, "2026-09"),
        term(2, "2026-09"),
        term(3, "optional", false),
      ]),
    ).toEqual({
      terms: [term(1, "2026-09"), term(2, "2026-09")],
      version: "2026-09",
    });
  });

  it("필수 약관이 없거나 버전이 비어 있거나 여러 개면 계약 오류로 처리한다", () => {
    expect(createRequiredTermsContract([term(1, "v1", false)])).toBeNull();
    expect(
      createRequiredTermsContract([term(1, ""), term(2, "v1")]),
    ).toBeNull();
    expect(
      createRequiredTermsContract([term(1, "v1"), term(2, "v2")]),
    ).toBeNull();
  });
});

describe("validateOnboardingNickname", () => {
  it("공백이거나 10자를 넘는 닉네임을 거절한다", () => {
    expect(validateOnboardingNickname("   ")).toBe("닉네임을 입력해 주세요.");
    expect(validateOnboardingNickname("12345678901")).toBe(
      "닉네임은 10자 이하로 입력해 주세요.",
    );
    expect(validateOnboardingNickname(" 비비디 ")).toBeUndefined();
  });
});
