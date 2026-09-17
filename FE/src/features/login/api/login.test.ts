import { afterEach, describe, expect, it, vi } from "vitest";

import { login, LoginApiError, LoginTimeoutError } from "./login";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("login", () => {
  it("세션 쿠키를 포함하도록 로그인 요청을 전송한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ nickname: "bibbidi" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      login({ nickname: "bibbidi", password: "wish" }),
    ).resolves.toEqual({ nickname: "bibbidi" });
    expect(fetchMock).toHaveBeenCalledWith("/api/login", {
      body: JSON.stringify({ nickname: "bibbidi", password: "wish" }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it("오류 응답을 API 오류로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 202,
            message: "인증 정보가 올바르지 않습니다.",
          }),
          {
            status: 401,
          },
        ),
      ),
    );

    await expect(
      login({ nickname: "unknown", password: "unknown-password" }),
    ).rejects.toEqual(
      new LoginApiError(202, 401, "인증 정보가 올바르지 않습니다."),
    );
  });

  it("응답 본문을 읽는 동안 10초가 지나면 Timeout 오류를 반환한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        Promise.resolve({
          json: () =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
          ok: true,
          status: 200,
        } as Response),
      ),
    );

    const requestExpectation = expect(
      login({ nickname: "bibbidi", password: "wish" }),
    ).rejects.toBeInstanceOf(LoginTimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);

    await requestExpectation;
  });
});
