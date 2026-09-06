import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignupForm } from "./SignupForm";

describe("SignupForm", () => {
  it("API 입력 계약을 충족하면 회원가입 버튼을 활성화한다", () => {
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);

    const submitButton = screen.getByRole("button", {
      name: "회원가입",
    }) as HTMLButtonElement;

    expect(submitButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "bibbidi" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), {
      target: { value: "wish" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "wish" },
    });

    expect(submitButton.disabled).toBe(false);
  });

  it("비밀번호 보기 기능을 노출하지 않는다", () => {
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);

    expect(screen.queryByRole("button", { name: "보기" })).toBeNull();
    expect(
      (screen.getByLabelText("비밀번호", { exact: true }) as HTMLInputElement)
        .type,
    ).toBe("password");
    expect(
      (screen.getByLabelText("비밀번호 확인") as HTMLInputElement).type,
    ).toBe("password");
  });

  it("상시 안내를 유효성 검사 오류로 교체한다", () => {
    render(<SignupForm loginLink={<a href="/login">로그인</a>} />);

    expect(
      screen.getByText("닉네임은 10자 이하로 입력해 주세요."),
    ).toBeTruthy();
    expect(
      screen.getByText("비밀번호는 4자 이상 20자 이하로 입력해 주세요."),
    ).toBeTruthy();

    fireEvent.blur(screen.getByLabelText("닉네임"));
    fireEvent.blur(screen.getByLabelText("비밀번호", { exact: true }));

    expect(screen.getByText("닉네임을 입력해 주세요.")).toBeTruthy();
    expect(screen.getByText("비밀번호를 입력해 주세요.")).toBeTruthy();
    expect(
      screen.queryByText("닉네임은 10자 이하로 입력해 주세요."),
    ).toBeNull();
    expect(
      screen.queryByText("비밀번호는 4자 이상 20자 이하로 입력해 주세요."),
    ).toBeNull();
  });
});
