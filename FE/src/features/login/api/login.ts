import { LoginResult, LoginValues } from "../model/login";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const LOGIN_ENDPOINT = `${apiBaseUrl}/api/login`;
const LOGIN_TIMEOUT_MS = 10_000;

interface LoginResponse {
  userId: number;
  nickname: string;
}

export class LoginApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "LoginApiError";
  }
}

export class LoginNetworkError extends Error {
  constructor() {
    super("로그인 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "LoginNetworkError";
  }
}

export class LoginTimeoutError extends Error {
  constructor() {
    super("로그인 요청 시간이 초과됐습니다.");
    this.name = "LoginTimeoutError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLoginResponse(value: unknown): value is LoginResponse {
  return (
    isRecord(value) &&
    typeof value.userId === "number" &&
    typeof value.nickname === "string"
  );
}

function toApiError(response: Response, body: unknown): LoginApiError {
  if (!isRecord(body)) {
    return new LoginApiError(
      0,
      response.status,
      "로그인 요청을 처리하지 못했습니다.",
    );
  }

  return new LoginApiError(
    typeof body.errorCode === "number" ? body.errorCode : 0,
    response.status,
    typeof body.message === "string"
      ? body.message
      : "로그인 요청을 처리하지 못했습니다.",
  );
}

export async function login(values: LoginValues): Promise<LoginResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    LOGIN_TIMEOUT_MS,
  );

  try {
    let response: Response;

    try {
      response = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
        credentials: "include",
        signal: controller.signal,
      });
    } catch (error) {
      if (isRecord(error) && error.name === "AbortError") {
        throw new LoginTimeoutError();
      }

      throw new LoginNetworkError();
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      if (isRecord(error) && error.name === "AbortError") {
        throw new LoginTimeoutError();
      }

      if (!response.ok) {
        throw toApiError(response, undefined);
      }

      throw new Error("로그인 성공 응답을 해석하지 못했습니다.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw toApiError(response, body);
    }

    if (!isLoginResponse(body)) {
      throw new Error("로그인 성공 응답 형식이 올바르지 않습니다.");
    }

    return {
      userId: body.userId,
      nickname: body.nickname,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
