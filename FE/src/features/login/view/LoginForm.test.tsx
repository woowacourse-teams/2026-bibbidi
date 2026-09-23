import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./LoginForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("인증 실패 오류 ID를 로그인 오류로 표시한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 202,
            message: "인증 정보가 올바르지 않습니다.",
          }),
          { status: 401 },
        ),
      ),
    );
    render(<LoginForm signupLink={<a href="/signup">회원가입</a>} />);

    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "unknown" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "unknown-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(
      await screen.findByText("닉네임 또는 비밀번호를 확인해 주세요."),
    ).toBeTruthy();
  });

  it("비밀번호 보기 기능을 노출하지 않는다", () => {
    render(<LoginForm signupLink={<a href="/signup">회원가입</a>} />);

    expect(screen.queryByRole("button", { name: "보기" })).toBeNull();
    expect((screen.getByLabelText("비밀번호") as HTMLInputElement).type).toBe(
      "password",
    );
  });

  it("기존 로그인 다음에 세 소셜 로그인 버튼을 순서대로 표시한다", () => {
    render(<LoginForm signupLink={<a href="/signup">회원가입</a>} />);

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual([
      "로그인",
      "카카오로 계속하기",
      "구글로 계속하기",
      "애플로 계속하기",
    ]);
    expect(
      screen.getByRole("separator", { name: "다른 로그인 방법" }),
    ).toBeTruthy();
  });

  it("소셜 로그인 버튼을 누르면 인증 요청 없이 준비 중 안내를 표시한다", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginForm signupLink={<a href="/signup">회원가입</a>} />);

    fireEvent.click(screen.getByRole("button", { name: "구글로 계속하기" }));

    expect(screen.getByRole("status").textContent).toBe(
      "구글 로그인은 준비 중이에요.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("카카오 버튼을 누르면 서버에 웹 인가 주소를 요청한다", async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginForm signupLink={<a href="/signup">회원가입</a>} />);

    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/oidc/kakao/authorization?clientType=WEB",
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
    expect(screen.getByRole("status").textContent).toBe(
      "카카오 로그인 화면으로 이동하고 있어요.",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "카카오로 계속하기",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("카카오 인가 주소를 받지 못하면 다시 시도하라는 안내를 표시한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<LoginForm signupLink={<a href="/signup">회원가입</a>} />);

    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }));

    expect(
      await screen.findByText(
        "카카오 로그인을 시작하지 못했어요. 다시 시도해 주세요.",
      ),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "카카오로 계속하기",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
