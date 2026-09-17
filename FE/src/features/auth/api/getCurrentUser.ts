import { CurrentUser } from "../model/auth";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const CURRENT_USER_ENDPOINT = `${apiBaseUrl}/api/users/me`;
const CURRENT_USER_TIMEOUT_MS = 10_000;

interface CurrentUserResponse {
  nickname: string;
}

interface ApiErrorResponse {
  errorCode: number;
  message: string;
}

export class CurrentUserApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CurrentUserApiError";
  }
}

export class CurrentUserNetworkError extends Error {
  constructor() {
    super("로그인 상태 확인 중 네트워크 오류가 발생했습니다.");
    this.name = "CurrentUserNetworkError";
  }
}

export class CurrentUserTimeoutError extends Error {
  constructor() {
    super("로그인 상태 확인 요청 시간이 초과됐습니다.");
    this.name = "CurrentUserTimeoutError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCurrentUserResponse(value: unknown): value is CurrentUserResponse {
  return isRecord(value) && typeof value.nickname === "string";
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    isRecord(value) &&
    typeof value.errorCode === "number" &&
    typeof value.message === "string"
  );
}

function toRequestError(error: unknown, didTimeout: boolean): Error {
  if (didTimeout) {
    return new CurrentUserTimeoutError();
  }

  if (isRecord(error) && error.name === "AbortError") {
    return new CurrentUserNetworkError();
  }

  return new CurrentUserNetworkError();
}

export async function getCurrentUser(
  signal?: AbortSignal,
): Promise<CurrentUser> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, CURRENT_USER_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await fetch(CURRENT_USER_ENDPOINT, {
        credentials: "include",
        method: "GET",
        signal: controller.signal,
      });
    } catch (error) {
      throw toRequestError(error, didTimeout);
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      if (
        didTimeout ||
        (isRecord(error) && error.name === "AbortError") ||
        error instanceof TypeError
      ) {
        throw toRequestError(error, didTimeout);
      }

      if (!response.ok) {
        throw new CurrentUserApiError(
          0,
          response.status,
          "로그인 상태를 확인하지 못했습니다.",
        );
      }

      throw new Error("현재 사용자 성공 응답을 해석하지 못했습니다.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new CurrentUserApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body)
          ? body.message
          : "로그인 상태를 확인하지 못했습니다.",
      );
    }

    if (!isCurrentUserResponse(body)) {
      throw new Error("현재 사용자 성공 응답 형식이 올바르지 않습니다.");
    }

    return {
      nickname: body.nickname,
    };
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}
