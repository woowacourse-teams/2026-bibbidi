import { afterEach, describe, expect, it, vi } from "vitest";

import {
  logout,
  LogoutApiError,
  LogoutContractError,
  LogoutNetworkError,
  LogoutRequestAbortedError,
  LogoutTimeoutError,
} from "./logout";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("logout", () => {
  it("세션 쿠키를 포함해 DELETE 요청하고 204 본문을 읽지 않는다", async () => {
    const response = {
      status: 204,
      ok: true,
      json: vi.fn(),
    } as unknown as Response;
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(logout()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/logout", {
      credentials: "include",
      method: "DELETE",
      signal: expect.any(AbortSignal),
    });
    expect(response.json).not.toHaveBeenCalled();
  });

  it("API 오류와 예상하지 못한 성공 상태를 구분한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "서버 내부 정보" }), {
          status: 500,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(logout()).rejects.toEqual(new LogoutApiError(500));
    await expect(logout()).rejects.toBeInstanceOf(LogoutContractError);
  });

  it("네트워크 오류를 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(logout()).rejects.toBeInstanceOf(LogoutNetworkError);
  });

  it("10초 동안 응답이 없으면 타임아웃으로 처리한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      ),
    );

    const expectation =
      expect(logout()).rejects.toBeInstanceOf(LogoutTimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });

  it("호출자 취소를 사용자 오류와 구분한다", async () => {
    const controller = new AbortController();
    const requestSignal: { current?: AbortSignal } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            requestSignal.current = init.signal ?? undefined;
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      ),
    );

    const expectation = expect(
      logout(controller.signal),
    ).rejects.toBeInstanceOf(LogoutRequestAbortedError);
    controller.abort();

    await expectation;
    expect(requestSignal.current?.aborted).toBe(true);
  });

  it("취소 신호를 무시한 fetch의 늦은 204도 성공으로 처리하지 않는다", async () => {
    const controller = new AbortController();
    let resolveRequest: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveRequest = resolve;
          }),
      ),
    );

    const expectation = expect(
      logout(controller.signal),
    ).rejects.toBeInstanceOf(LogoutRequestAbortedError);
    controller.abort();
    resolveRequest(new Response(null, { status: 204 }));

    await expectation;
  });
});
