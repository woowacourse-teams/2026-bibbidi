const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const WEB_SESSION_REFRESH_ENDPOINT = `${apiBaseUrl}/api/auth/web/sessions/refresh`;
const WEB_SESSION_REFRESH_TIMEOUT_MS = 10_000;

export interface WebSessionResponse {
  accessToken: string;
  termsAgreementRequired: boolean;
}

interface ApiErrorResponse {
  errorCode: number;
  message: string;
}

export type WebSessionRefreshFailureReason =
  "aborted" | "network" | "response" | "timeout";

export class WebSessionExpiredError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
  ) {
    super("로그인이 만료되었습니다. 다시 로그인해 주세요.");
    this.name = "WebSessionExpiredError";
  }
}

export class WebSessionRefreshError extends Error {
  constructor(
    readonly status: number | null,
    readonly reason: WebSessionRefreshFailureReason,
  ) {
    super("로그인 상태를 갱신하지 못했습니다.");
    this.name = "WebSessionRefreshError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    isRecord(value) &&
    typeof value.errorCode === "number" &&
    typeof value.message === "string"
  );
}

function isWebSessionResponse(value: unknown): value is WebSessionResponse {
  return (
    isRecord(value) &&
    typeof value.accessToken === "string" &&
    typeof value.termsAgreementRequired === "boolean"
  );
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function requestWebSessionRefresh(
  signal?: AbortSignal,
): Promise<WebSessionResponse> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, WEB_SESSION_REFRESH_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await fetch(WEB_SESSION_REFRESH_ENDPOINT, {
        credentials: "include",
        method: "POST",
        signal: controller.signal,
      });
    } catch {
      const reason = didTimeout
        ? "timeout"
        : signal?.aborted
          ? "aborted"
          : "network";
      throw new WebSessionRefreshError(null, reason);
    }

    const body = await parseResponseBody(response);

    if (controller.signal.aborted) {
      throw new WebSessionRefreshError(
        null,
        didTimeout ? "timeout" : "aborted",
      );
    }

    if (response.status === 401) {
      throw new WebSessionExpiredError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
      );
    }

    if (!response.ok || !isWebSessionResponse(body)) {
      throw new WebSessionRefreshError(response.status, "response");
    }

    return body;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}
