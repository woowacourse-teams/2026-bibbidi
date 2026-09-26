import { authenticatedFetch } from "../../../infrastructure/http/authenticatedFetch";
import { WebSessionExpiredError } from "../../../infrastructure/auth/webSessionApi";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const LEGACY_ACCOUNT_TRANSFER_ENDPOINT = `${apiBaseUrl}/api/users/me/legacy-account-transfer`;
const NICKNAME_ENDPOINT = `${apiBaseUrl}/api/users/me/nickname`;
const ACCOUNT_SETUP_REQUEST_TIMEOUT_MS = 10_000;

export interface AccountTransferSession {
  accessToken: string;
  termsAgreementRequired: boolean;
}

export class AccountSetupApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
  ) {
    super("계정 설정 요청을 처리하지 못했습니다.");
    this.name = "AccountSetupApiError";
  }
}

export class AccountSetupAuthenticationRequiredError extends Error {
  constructor() {
    super("계정 설정을 계속하려면 로그인이 필요합니다.");
    this.name = "AccountSetupAuthenticationRequiredError";
  }
}

export class AccountSetupNetworkError extends Error {
  constructor() {
    super("계정 설정 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "AccountSetupNetworkError";
  }
}

export class AccountSetupTimeoutError extends Error {
  constructor() {
    super("계정 설정 요청 시간이 초과됐습니다.");
    this.name = "AccountSetupTimeoutError";
  }
}

export class AccountSetupRequestAbortedError extends Error {
  constructor() {
    super("계정 설정 요청이 취소됐습니다.");
    this.name = "AccountSetupRequestAbortedError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorCodeOf(value: unknown): number {
  return isRecord(value) && typeof value.errorCode === "number"
    ? value.errorCode
    : 0;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function requestJson(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, ACCOUNT_SETUP_REQUEST_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await authenticatedFetch(
        url,
        {
          ...init,
          credentials: "include",
          signal: controller.signal,
        },
        { retryUnauthorized: false },
      );
    } catch (error) {
      if (signal?.aborted) {
        throw new AccountSetupRequestAbortedError();
      }

      if (didTimeout) {
        throw new AccountSetupTimeoutError();
      }

      if (error instanceof WebSessionExpiredError) {
        throw new AccountSetupAuthenticationRequiredError();
      }

      throw new AccountSetupNetworkError();
    }

    const body = await parseResponseBody(response);

    if (signal?.aborted) {
      throw new AccountSetupRequestAbortedError();
    }

    if (didTimeout) {
      throw new AccountSetupTimeoutError();
    }

    if (!response.ok) {
      throw new AccountSetupApiError(errorCodeOf(body), response.status);
    }

    return body;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export async function transferLegacyAccount(
  nickname: string,
  password: string,
  signal?: AbortSignal,
): Promise<AccountTransferSession> {
  const body = await requestJson(
    LEGACY_ACCOUNT_TRANSFER_ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, password }),
    },
    signal,
  );

  if (
    !isRecord(body) ||
    typeof body.accessToken !== "string" ||
    typeof body.termsAgreementRequired !== "boolean"
  ) {
    throw new AccountSetupApiError(0, 200);
  }

  return {
    accessToken: body.accessToken,
    termsAgreementRequired: body.termsAgreementRequired,
  };
}

export async function changeAccountNickname(
  nickname: string,
  signal?: AbortSignal,
): Promise<void> {
  const body = await requestJson(
    NICKNAME_ENDPOINT,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    },
    signal,
  );

  if (!isRecord(body) || typeof body.nickname !== "string") {
    throw new AccountSetupApiError(0, 200);
  }
}
