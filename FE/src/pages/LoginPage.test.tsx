import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("소셜 로그인 버튼을 표시하고 기존 계정 연동 안내는 표시하지 않는다", () => {
    render(<LoginPage />);

    expect(screen.getByRole("region", { name: "소셜 로그인" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "로그인" })).toBeNull();
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
    expect(screen.queryByText("기존 계정이 있으신가요?")).toBeNull();
    expect(
      screen.queryByText("소셜 로그인 후 기존 계정과 연동할 수 있어요."),
    ).toBeNull();
  });
});
