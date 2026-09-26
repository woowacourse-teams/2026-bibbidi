import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SocialLoginForm } from "./SocialLoginForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SocialLoginForm", () => {
  it("세 소셜 로그인 버튼과 기존 계정 연동 안내를 표시한다", () => {
    render(<SocialLoginForm />);

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["카카오로 계속하기", "구글로 계속하기", "애플로 계속하기"]);
    const guide = screen.getByRole("complementary", {
      name: "기존 계정이 있으신가요?",
    });
    expect(guide.textContent).toContain(
      "소셜 로그인을 진행하면 기존 계정과 연동할 수 있어요.",
    );
  });

  it("연결되지 않은 애플 로그인은 준비 중 안내만 표시한다", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SocialLoginForm />);

    fireEvent.click(screen.getByRole("button", { name: "애플로 계속하기" }));

    expect(screen.getByRole("status").textContent).toBe(
      "애플 로그인은 준비 중이에요.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("소셜 로그인 이동 중에는 중복 요청을 막는다", () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<SocialLoginForm />);

    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/oidc/kakao/authorization?clientType=WEB",
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
    expect(screen.getByRole("status").textContent).toBe(
      "카카오 로그인 화면으로 이동하고 있어요.",
    );
    screen.getAllByRole("button").forEach((button) => {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("뒤로가기로 페이지가 복원되면 이동 상태와 오래된 안내를 초기화한다", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<SocialLoginForm />);

    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }));
    fireEvent(window, new Event("pageshow"));

    screen.getAllByRole("button").forEach((button) => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("인가 주소 요청에 실패하면 다시 시도할 수 있다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<SocialLoginForm />);

    fireEvent.click(screen.getByRole("button", { name: "구글로 계속하기" }));

    expect(
      await screen.findByText(
        "구글 로그인을 시작하지 못했어요. 다시 시도해 주세요.",
      ),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "구글로 계속하기",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
