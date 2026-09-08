import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CurrentUserApiError,
  CurrentUserNetworkError,
  CurrentUserTimeoutError,
  getCurrentUser,
} from "./getCurrentUser";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("getCurrentUser", () => {
  it("세션 쿠키를 포함해 현재 사용자를 조회한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ nickname: "bibbidi" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUser()).resolves.toEqual({
      nickname: "bibbidi",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/users/me", {
      credentials: "include",
      method: "GET",
      signal: expect.any(AbortSignal),
    });
  });

  it("HTTP 오류를 공개 오류 정보가 있는 API 오류로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 201,
            message: "로그인이 필요합니다.",
          }),
          { status: 401 },
        ),
      ),
    );

    await expect(getCurrentUser()).rejects.toEqual(
      new CurrentUserApiError(201, 401, "로그인이 필요합니다."),
    );
  });

  it("네트워크 오류를 공개 메시지가 있는 오류로 변환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(getCurrentUser()).rejects.toBeInstanceOf(
      CurrentUserNetworkError,
    );
  });

  it("10초 동안 응답이 없으면 타임아웃 오류로 변환한다", async () => {
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

    const request = getCurrentUser();
    const expectation = expect(request).rejects.toBeInstanceOf(
      CurrentUserTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });

  it("응답 본문을 읽는 동안 10초가 지나도 타임아웃 오류로 변환한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) =>
        Promise.resolve({
          json: () =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
          ok: true,
        } satisfies Pick<Response, "json" | "ok">),
      ),
    );

    const request = getCurrentUser();
    const expectation = expect(request).rejects.toBeInstanceOf(
      CurrentUserTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });

  it("계약과 다른 성공 응답은 거부한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ nickname: 3 }), { status: 200 }),
        ),
    );

    await expect(getCurrentUser()).rejects.toThrow(
      "현재 사용자 성공 응답 형식이 올바르지 않습니다.",
    );
  });
});
