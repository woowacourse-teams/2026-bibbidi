import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetWebAuthSessionForTest } from "../../infrastructure/auth/webSessionManager";
import { AuthProvider, useAuth } from "./AuthProvider";

beforeEach(() => {
  resetWebAuthSessionForTest();
});

afterEach(() => {
  resetWebAuthSessionForTest();
  vi.unstubAllGlobals();
});

function expiredWebSessionResponse() {
  return new Response(
    JSON.stringify({
      errorCode: 206,
      message: "로그인 상태를 유지할 수 없습니다.",
    }),
    { status: 401 },
  );
}

function AuthStateView() {
  const { authState } = useAuth();

  if (
    authState.status === "authenticated" ||
    authState.status === "synchronizing"
  ) {
    return (
      <p>
        {authState.status} 사용자 {authState.user.nickname}
      </p>
    );
  }

  return <p>{authState.status}</p>;
}

function AuthActionView() {
  const { endAuthentication, refreshAuth } = useAuth();

  return (
    <>
      <AuthStateView />
      <button onClick={refreshAuth} type="button">
        인증 다시 확인
      </button>
      <button onClick={endAuthentication} type="button">
        인증 종료
      </button>
    </>
  );
}

describe("AuthProvider", () => {
  it("refresh cookie로 복구한 access token으로 현재 사용자를 조회한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "header.payload.signature",
            termsAgreementRequired: false,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nickname: "bibbidi" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    expect(
      await screen.findByText("synchronizing 사용자 bibbidi"),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth/web/sessions/refresh",
      {
        credentials: "include",
        method: "POST",
        signal: expect.any(AbortSignal),
      },
    );
    const currentUserInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(currentUserInit.headers).get("Authorization")).toBe(
      "Bearer header.payload.signature",
    );
  });

  it("약관 동의가 필요한 소셜 세션은 현재 사용자를 조회하지 않는다", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accessToken: "header.payload.signature",
          termsAgreementRequired: true,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    expect(await screen.findByText("guest")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refresh의 일시적인 네트워크 실패를 비로그인으로 확정하지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    expect(
      await screen.findByText("로그인 상태를 확인하지 못했습니다."),
    ).toBeTruthy();
    expect(screen.queryByText("guest")).toBeNull();
  });

  it("현재 사용자 응답으로 체크리스트 동기화 상태를 시작한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(expiredWebSessionResponse())
        .mockResolvedValueOnce(
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

    expect(screen.getByText("loading")).toBeTruthy();
    expect(
      await screen.findByText("synchronizing 사용자 bibbidi"),
    ).toBeTruthy();
  });

  it.each([401, 404])("%i 응답을 비로그인 상태로 처리한다", async (status) => {
    const errorCode = status === 401 ? 201 : 301;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(expiredWebSessionResponse())
        .mockResolvedValueOnce(
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
        .mockResolvedValueOnce(expiredWebSessionResponse())
        .mockResolvedValueOnce(
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
      .mockResolvedValueOnce(expiredWebSessionResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errorCode: 901, message: "서버 오류" }), {
          status: 500,
        }),
      )
      .mockResolvedValueOnce(expiredWebSessionResponse())
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

    expect(
      await screen.findByText("synchronizing 사용자 bibbidi"),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("인증 조회가 늦게 완료돼도 로그아웃 후 인증을 되살리지 않는다", async () => {
    let resolveCurrentUser: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(expiredWebSessionResponse())
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveCurrentUser = resolve;
            }),
        ),
    );

    render(
      <AuthProvider>
        <AuthActionView />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "인증 종료" }));
    expect(screen.getByText("guest")).toBeTruthy();

    await act(async () => {
      resolveCurrentUser(
        new Response(JSON.stringify({ nickname: "이전 사용자" }), {
          status: 200,
        }),
      );
    });

    expect(screen.getByText("guest")).toBeTruthy();
    expect(screen.queryByText(/이전 사용자/)).toBeNull();
  });

  it("갱신 중인 이전 refresh를 로그아웃 시 취소한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(expiredWebSessionResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nickname: "비비디" }), { status: 200 }),
      )
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthActionView />
      </AuthProvider>,
    );
    expect(await screen.findByText("synchronizing 사용자 비비디")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "인증 다시 확인" }));
    expect(screen.getByText("loading")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "인증 종료" }));

    expect(screen.getByText("guest")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).signal?.aborted).toBe(
      true,
    );
  });
});
