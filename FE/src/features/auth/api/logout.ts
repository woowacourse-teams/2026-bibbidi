import { clearWebAccessToken } from "../../../infrastructure/auth/webSessionManager";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const LOGOUT_ENDPOINT = `${apiBaseUrl}/api/auth/web/sessions/current`;
const LOGOUT_TIMEOUT_MS = 10_000;

export class LogoutApiError extends Error {
  constructor(readonly status: number) {
    super("로그아웃 요청을 처리하지 못했습니다.");
    this.name = "LogoutApiError";
  }
}

export class LogoutContractError extends Error {
  constructor() {
    super("로그아웃 성공 응답 형식이 올바르지 않습니다.");
    this.name = "LogoutContractError";
  }
}

export class LogoutNetworkError extends Error {
  constructor() {
    super("로그아웃 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "LogoutNetworkError";
  }
}

export class LogoutTimeoutError extends Error {
  constructor() {
    super("로그아웃 요청 시간이 초과됐습니다.");
    this.name = "LogoutTimeoutError";
  }
}

export class LogoutRequestAbortedError extends Error {
  constructor() {
    super("로그아웃 요청이 취소됐습니다.");
    this.name = "LogoutRequestAbortedError";
  }
}

function toRequestError(didTimeout: boolean, wasCallerAborted: boolean): Error {
  if (wasCallerAborted) {
    return new LogoutRequestAbortedError();
  }

  return didTimeout ? new LogoutTimeoutError() : new LogoutNetworkError();
}

export async function logout(signal?: AbortSignal): Promise<void> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, LOGOUT_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await fetch(LOGOUT_ENDPOINT, {
        credentials: "include",
        method: "DELETE",
        signal: controller.signal,
      });
    } catch {
      throw toRequestError(didTimeout, signal?.aborted === true);
    }

    if (controller.signal.aborted) {
      throw toRequestError(didTimeout, signal?.aborted === true);
    }

    if (response.status === 204) {
      clearWebAccessToken();
      return;
    }

    if (!response.ok) {
      throw new LogoutApiError(response.status);
    }

    throw new LogoutContractError();
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}
