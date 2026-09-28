import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("일반 로그인과 회원가입 없이 소셜 로그인과 기존 계정 안내를 표시한다", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "로그인" })).toBeTruthy();
    expect(screen.queryByLabelText("닉네임")).toBeNull();
    expect(screen.queryByLabelText("비밀번호")).toBeNull();
    expect(screen.queryByRole("link", { name: "회원가입" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "카카오로 계속하기" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "구글로 계속하기" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "애플로 계속하기" }),
    ).toBeTruthy();
    expect(screen.getByText("기존 계정이 있으신가요?")).toBeTruthy();
    expect(
      screen.getByText("소셜 로그인을 진행하면 기존 계정과 연동할 수 있어요."),
    ).toBeTruthy();
  });
});
