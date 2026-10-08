import { vi } from "vitest";

type TestFetchImplementation = (
  url: string,
  init?: RequestInit,
) => Promise<unknown>;

const WEB_SESSION_REFRESH_ENDPOINT = "/api/auth/web/sessions/refresh";

export function installLegacyWebSessionFetch(
  fetchImplementation: TestFetchImplementation,
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url === WEB_SESSION_REFRESH_ENDPOINT) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              errorCode: 206,
              message: "로그인 상태를 유지할 수 없습니다.",
            }),
            { status: 401 },
          ),
        );
      }

      return fetchImplementation(url, init);
    }),
  );
}
