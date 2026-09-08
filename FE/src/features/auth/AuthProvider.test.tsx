import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./AuthProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

function AuthStateView() {
  const { authState } = useAuth();

  if (authState.status === "authenticated") {
    return <p>로그인 사용자 {authState.user.nickname}</p>;
  }

  return <p>{authState.status}</p>;
}

describe("AuthProvider", () => {
  it("현재 사용자 응답으로 로그인 상태를 복원한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nickname: "bibbidi" }), {
          status: 200,
        }),
      ),
    );

    render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    expect(screen.getByRole("status").textContent).toBe(
      "로그인 상태를 확인하고 있습니다.",
    );
    expect(await screen.findByText("로그인 사용자 bibbidi")).toBeTruthy();
  });

  it.each([401, 404])("%i 응답을 비로그인 상태로 처리한다", async (status) => {
    const errorCode = status === 401 ? 201 : 301;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ errorCode, message: "인증 정보가 없습니다." }),
            { status },
          ),
        ),
    );

    render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    expect(await screen.findByText("guest")).toBeTruthy();
  });

  it("인증 계약이 아닌 404 응답은 인증 확인 실패로 처리한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ errorCode: 302, message: "리소스가 없습니다." }),
            { status: 404 },
          ),
        ),
    );

    render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    expect(
      await screen.findByText("로그인 상태를 확인하지 못했습니다."),
    ).toBeTruthy();
  });

  it("인증 확인 실패를 안내하고 다시 시도한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errorCode: 901, message: "서버 오류" }), {
          status: 500,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nickname: "bibbidi" }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    expect(
      await screen.findByText("로그인 상태를 확인하지 못했습니다."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("로그인 사용자 bibbidi")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
