import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("입력 여부와 관계없이 로그인 버튼을 활성화한다", () => {
    render(<LoginForm signupLink={<a href="/signup">회원가입</a>} />);

    const submitButton = screen.getByRole("button", {
      name: "로그인",
    }) as HTMLButtonElement;

    expect(submitButton.disabled).toBe(false);
  });

  it("유효하지 않은 입력으로 로그인하면 오류 메시지를 표시한다", () => {
    render(<LoginForm signupLink={<a href="/signup">회원가입</a>} />);

    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(
      screen.getByText("닉네임 또는 비밀번호를 확인해 주세요."),
    ).toBeTruthy();
  });

  it("비밀번호 보기 기능을 노출하지 않는다", () => {
    render(<LoginForm signupLink={<a href="/signup">회원가입</a>} />);

    expect(screen.queryByRole("button", { name: "보기" })).toBeNull();
    expect((screen.getByLabelText("비밀번호") as HTMLInputElement).type).toBe(
      "password",
    );
  });
});
