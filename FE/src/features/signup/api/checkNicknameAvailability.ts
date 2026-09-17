const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const NICKNAME_AVAILABILITY_ENDPOINT = `${apiBaseUrl}/api/users/nickname/availability`;
const NICKNAME_AVAILABILITY_TIMEOUT_MS = 10_000;

export interface NicknameAvailability {
  available: boolean;
  nickname: string;
}

interface ApiFieldError {
  field: string;
  message: string;
}

export class NicknameAvailabilityApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message: string,
    readonly fieldErrors: ApiFieldError[] = [],
  ) {
    super(message);
    this.name = "NicknameAvailabilityApiError";
  }
}

export class NicknameAvailabilityNetworkError extends Error {
  constructor() {
    super("닉네임 중복 확인 중 네트워크 오류가 발생했습니다.");
    this.name = "NicknameAvailabilityNetworkError";
  }
}

export class NicknameAvailabilityTimeoutError extends Error {
  constructor() {
    super("닉네임 중복 확인 요청 시간이 초과됐습니다.");
    this.name = "NicknameAvailabilityTimeoutError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNicknameAvailability(value: unknown): value is NicknameAvailability {
  return (
    isRecord(value) &&
    typeof value.nickname === "string" &&
    typeof value.available === "boolean"
  );
}

function parseFieldErrors(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (error): error is ApiFieldError =>
      isRecord(error) &&
      typeof error.field === "string" &&
      typeof error.message === "string",
  );
}

function toApiError(
  response: Response,
  body: unknown,
): NicknameAvailabilityApiError {
  if (!isRecord(body)) {
    return new NicknameAvailabilityApiError(
      0,
      response.status,
      "닉네임 중복 확인 요청을 처리하지 못했습니다.",
    );
  }

  return new NicknameAvailabilityApiError(
    typeof body.errorCode === "number" ? body.errorCode : 0,
    response.status,
    typeof body.message === "string"
      ? body.message
      : "닉네임 중복 확인 요청을 처리하지 못했습니다.",
    parseFieldErrors(body.errors),
  );
}

export async function checkNicknameAvailability(
  nickname: string,
): Promise<NicknameAvailability> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    NICKNAME_AVAILABILITY_TIMEOUT_MS,
  );
  const query = new URLSearchParams({ nickname });

  try {
    let response: Response;

    try {
      response = await fetch(`${NICKNAME_AVAILABILITY_ENDPOINT}?${query}`, {
        method: "GET",
        signal: controller.signal,
      });
    } catch (error) {
      if (isRecord(error) && error.name === "AbortError") {
        throw new NicknameAvailabilityTimeoutError();
      }

      throw new NicknameAvailabilityNetworkError();
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      if (isRecord(error) && error.name === "AbortError") {
        throw new NicknameAvailabilityTimeoutError();
      }

      if (!response.ok) {
        throw toApiError(response, undefined);
      }

      throw new Error("닉네임 중복 확인 응답을 해석하지 못했습니다.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw toApiError(response, body);
    }

    if (!isNicknameAvailability(body)) {
      throw new Error("닉네임 중복 확인 응답 형식이 올바르지 않습니다.");
    }

    if (body.nickname !== nickname) {
      throw new Error("닉네임 중복 확인 응답의 닉네임이 일치하지 않습니다.");
    }

    return body;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
