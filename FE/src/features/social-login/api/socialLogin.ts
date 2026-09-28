import { SocialLoginSession } from "../model/socialLogin";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const SOCIAL_LOGIN_TIMEOUT_MS = 10_000;

export class SocialLoginApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SocialLoginApiError";
  }
}

export class SocialLoginNetworkError extends Error {
  constructor() {
    super("소셜 로그인 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "SocialLoginNetworkError";
  }
}

export class SocialLoginTimeoutError extends Error {
  constructor() {
    super("소셜 로그인 요청 시간이 초과됐습니다.");
    this.name = "SocialLoginTimeoutError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toApiError(response: Response, body: unknown): SocialLoginApiError {
  const fallbackMessage = "소셜 로그인 요청을 처리하지 못했습니다.";

  if (!isRecord(body)) {
    return new SocialLoginApiError(0, response.status, fallbackMessage);
  }

  return new SocialLoginApiError(
    typeof body.errorCode === "number" ? body.errorCode : 0,
    response.status,
    typeof body.message === "string" ? body.message : fallbackMessage,
  );
}

async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    SOCIAL_LOGIN_TIMEOUT_MS,
  );

  try {
    let response: Response;

    try {
      // 인가를 시작한 브라우저인지 서버가 쿠키로 확인하므로 쿠키를 주고받는다.
      response = await fetch(url, {
        ...init,
        credentials: "include",
        signal: controller.signal,
      });
    } catch (error) {
      if (isRecord(error) && error.name === "AbortError") {
        throw new SocialLoginTimeoutError();
      }

      throw new SocialLoginNetworkError();
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      if (isRecord(error) && error.name === "AbortError") {
        throw new SocialLoginTimeoutError();
      }

      if (!response.ok) {
        throw toApiError(response, undefined);
      }

      throw new Error("소셜 로그인 응답을 해석하지 못했습니다.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw toApiError(response, body);
    }

    return body;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function startSocialAuthorization(
  provider: string,
): Promise<string> {
  const query = new URLSearchParams({ clientType: "WEB" });
  const body = await requestJson(
    `${apiBaseUrl}/api/auth/oidc/${provider}/authorization?${query}`,
    { method: "GET" },
  );

  if (!isRecord(body) || typeof body.authorizationUri !== "string") {
    throw new Error("소셜 로그인 시작 응답 형식이 올바르지 않습니다.");
  }

  return body.authorizationUri;
}

export async function completeSocialLogin(
  provider: string,
  code: string,
  state: string,
): Promise<SocialLoginSession> {
  const body = await requestJson(
    `${apiBaseUrl}/api/auth/web/oidc/${provider}/callback`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, state }),
    },
  );

  if (
    !isRecord(body) ||
    typeof body.accessToken !== "string" ||
    typeof body.termsAgreementRequired !== "boolean"
  ) {
    throw new Error("소셜 로그인 완료 응답 형식이 올바르지 않습니다.");
  }

  return {
    accessToken: body.accessToken,
    termsAgreementRequired: body.termsAgreementRequired,
  };
}
