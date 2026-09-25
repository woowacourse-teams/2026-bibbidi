import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acceptWebAccessToken,
  hasWebAccessToken,
  resetWebAuthSessionForTest,
  subscribeAuthenticationRequired,
} from "../auth/webSessionManager";
import { authenticatedFetch } from "./authenticatedFetch";

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
  vi.unstubAllGlobals();
});

describe("authenticatedFetch", () => {
  it("메모리 access token을 Bearer 헤더에 넣는다", async () => {
    const token = accessToken(Date.now() + 120_000);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    acceptWebAccessToken(token);

    await authenticatedFetch("/api/users/me", { method: "GET" });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(requestInit.headers).get("Authorization")).toBe(
      `Bearer ${token}`,
    );
  });

  it("예상하지 못한 401 뒤 refresh하고 원 요청을 한 번 재시도한다", async () => {
    const currentToken = accessToken(Date.now() + 120_000);
    const refreshedToken = accessToken(Date.now() + 300_000);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ errorCode: 204 }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: refreshedToken,
          termsAgreementRequired: false,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    acceptWebAccessToken(currentToken);

    await expect(authenticatedFetch("/api/users/me")).resolves.toMatchObject({
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(new Headers(retryInit.headers).get("Authorization")).toBe(
      `Bearer ${refreshedToken}`,
    );
  });

  it("원 요청과 refresh가 401이면 확정적인 인증 만료로 알린다", async () => {
    const listener = vi.fn();
    subscribeAuthenticationRequired(listener);
    acceptWebAccessToken(accessToken(Date.now() + 120_000));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { errorCode: 204, message: "로그인이 만료되었습니다." },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { errorCode: 206, message: "로그인 상태를 유지할 수 없습니다." },
          401,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(authenticatedFetch("/api/users/me")).resolves.toMatchObject({
      status: 401,
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("refresh 후 재시도도 401이면 token을 지우고 인증 만료로 알린다", async () => {
    const listener = vi.fn();
    subscribeAuthenticationRequired(listener);
    acceptWebAccessToken(accessToken(Date.now() + 120_000));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ errorCode: 204 }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: accessToken(Date.now() + 300_000),
          termsAgreementRequired: false,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ errorCode: 204 }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(authenticatedFetch("/api/users/me")).resolves.toMatchObject({
      status: 401,
    });

    expect(hasWebAccessToken()).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
  });
});
