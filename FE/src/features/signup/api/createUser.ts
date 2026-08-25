import { SignupValues } from "../model/signup";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const CREATE_USER_ENDPOINT = `${apiBaseUrl}/api/users`;
const CREATE_USER_TIMEOUT_MS = 10_000;

export interface CreateUserResponse {
  id: number;
  nickname: string;
}

interface ApiFieldError {
  field: string;
  message: string;
}

export class CreateUserApiError extends Error {
  constructor(
    readonly id: number,
    readonly status: number,
    message: string,
    readonly fieldErrors: ApiFieldError[] = [],
  ) {
    super(message);
    this.name = "CreateUserApiError";
  }
}

export class CreateUserNetworkError extends Error {
  constructor() {
    super("회원가입 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "CreateUserNetworkError";
  }
}

export class CreateUserTimeoutError extends Error {
  constructor() {
    super("회원가입 요청 시간이 초과됐습니다.");
    this.name = "CreateUserTimeoutError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCreateUserResponse(value: unknown): value is CreateUserResponse {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.nickname === "string"
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

function toApiError(response: Response, body: unknown): CreateUserApiError {
  if (!isRecord(body)) {
    return new CreateUserApiError(
      0,
      response.status,
      "회원가입 요청을 처리하지 못했습니다.",
    );
  }

  return new CreateUserApiError(
    typeof body.id === "number" ? body.id : 0,
    typeof body.status === "number" ? body.status : response.status,
    typeof body.message === "string"
      ? body.message
      : "회원가입 요청을 처리하지 못했습니다.",
    parseFieldErrors(body.errors),
  );
}

export async function createUser(
  values: SignupValues,
): Promise<CreateUserResponse> {
  let response: Response;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    CREATE_USER_TIMEOUT_MS,
  );

  try {
    response = await fetch(CREATE_USER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
      signal: controller.signal,
    });
  } catch (error) {
    if (isRecord(error) && error.name === "AbortError") {
      throw new CreateUserTimeoutError();
    }

    throw new CreateUserNetworkError();
  } finally {
    window.clearTimeout(timeoutId);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw toApiError(response, undefined);
    }

    throw new Error("회원가입 성공 응답을 해석하지 못했습니다.");
  }

  if (!response.ok) {
    throw toApiError(response, body);
  }

  if (!isCreateUserResponse(body)) {
    throw new Error("회원가입 성공 응답 형식이 올바르지 않습니다.");
  }

  return body;
}
