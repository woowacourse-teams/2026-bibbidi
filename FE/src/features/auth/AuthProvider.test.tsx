import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./AuthProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  it("현재 사용자 응답으로 체크리스트 동기화 상태를 시작한다", async () => {
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

    expect(
      await screen.findByText("synchronizing 사용자 bibbidi"),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("인증 조회가 늦게 완료돼도 로그아웃 후 인증을 되살리지 않는다", async () => {
    let resolveCurrentUser: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
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

  it("갱신 중인 이전 인증 조회도 로그아웃 후 무시한다", async () => {
    let resolveRefreshedUser: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nickname: "비비디" }), { status: 200 }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveRefreshedUser = resolve;
          }),
      );
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

    await act(async () => {
      resolveRefreshedUser(
        new Response(JSON.stringify({ nickname: "비비디" }), { status: 200 }),
      );
    });

    expect(screen.getByText("guest")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
