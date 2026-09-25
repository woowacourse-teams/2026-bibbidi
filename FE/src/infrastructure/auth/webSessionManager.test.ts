import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acceptWebAccessToken,
  accessTokenForRequest,
  clearWebAccessToken,
  hasWebAccessToken,
  refreshWebSession,
  resetWebAuthSessionForTest,
  subscribeAuthenticationRequired,
} from "./webSessionManager";
import { WebSessionRefreshError } from "./webSessionApi";

function accessToken(expiresAt: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(expiresAt / 1_000) }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  resetWebAuthSessionForTest();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("webSessionManager", () => {
  it("access token을 Web Storage에 기록하지 않는다", () => {
    const localStorageSetItem = vi.fn();
    const sessionStorageSetItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem: localStorageSetItem });
    vi.stubGlobal("sessionStorage", { setItem: sessionStorageSetItem });

    acceptWebAccessToken(accessToken(Date.now() + 120_000));

    expect(localStorageSetItem).not.toHaveBeenCalled();
    expect(sessionStorageSetItem).not.toHaveBeenCalled();
  });

  it("동시에 필요한 refresh 요청을 하나로 합친다", async () => {
    let resolveRefresh: (response: Response) => void = () => undefined;
    const refreshedToken = accessToken(Date.now() + 120_000);
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = refreshWebSession();
    const second = refreshWebSession();
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveRefresh(
      jsonResponse({
        accessToken: refreshedToken,
        termsAgreementRequired: false,
      }),
    );

    await expect(Promise.all([first, second])).resolves.toEqual([
      { accessToken: refreshedToken, termsAgreementRequired: false },
      { accessToken: refreshedToken, termsAgreementRequired: false },
    ]);
  });

  it("만료 60초 전에 자동으로 refresh한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T00:00:00Z"));
    const currentToken = accessToken(Date.now() + 61_000);
    const refreshedToken = accessToken(Date.now() + 300_000);
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        accessToken: refreshedToken,
        termsAgreementRequired: false,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    acceptWebAccessToken(currentToken);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/web/sessions/refresh", {
      credentials: "include",
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it("응답하지 않는 refresh를 10초 후 일시 오류로 종료한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );

    const expectation = expect(refreshWebSession()).rejects.toEqual(
      new WebSessionRefreshError(null, "timeout"),
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });

  it("새 token을 받은 후 늦게 도착한 refresh 응답을 무시한다", async () => {
    let resolveRefresh: (response: Response) => void = () => undefined;
    const oldToken = accessToken(Date.now() + 120_000);
    const newToken = accessToken(Date.now() + 300_000);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveRefresh = resolve;
          }),
      ),
    );

    const staleRefresh = refreshWebSession();
    acceptWebAccessToken(newToken);
    resolveRefresh(
      jsonResponse({
        accessToken: oldToken,
        termsAgreementRequired: false,
      }),
    );

    await expect(staleRefresh).rejects.toEqual(
      new WebSessionRefreshError(null, "aborted"),
    );
    expect(accessTokenForRequest()).toBe(newToken);
  });

  it("로그아웃 후 늦게 도착한 refresh 응답으로 token을 복구하지 않는다", async () => {
    let resolveRefresh: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveRefresh = resolve;
          }),
      ),
    );

    const staleRefresh = refreshWebSession();
    clearWebAccessToken();
    resolveRefresh(
      jsonResponse({
        accessToken: accessToken(Date.now() + 120_000),
        termsAgreementRequired: false,
      }),
    );

    await expect(staleRefresh).rejects.toEqual(
      new WebSessionRefreshError(null, "aborted"),
    );
    expect(hasWebAccessToken()).toBe(false);
  });

  it("refresh 네트워크 실패를 일시 오류로 유지한다", async () => {
    const listener = vi.fn();
    subscribeAuthenticationRequired(listener);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(refreshWebSession()).rejects.toEqual(
      new WebSessionRefreshError(null, "network"),
    );
    expect(listener).not.toHaveBeenCalled();
  });
});
