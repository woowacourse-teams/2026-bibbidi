import { authenticatedFetch } from "../../../infrastructure/http/authenticatedFetch";
import { OnboardingTerm } from "../model/onboarding";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const TERMS_ENDPOINT = `${apiBaseUrl}/api/terms`;
const TERMS_AGREEMENT_ENDPOINT = `${apiBaseUrl}/api/users/me/terms-agreement`;
const ONBOARDING_REQUEST_TIMEOUT_MS = 10_000;

type RequestKind = "public" | "authenticated";

export class OnboardingApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
  ) {
    super("온보딩 요청을 처리하지 못했습니다.");
    this.name = "OnboardingApiError";
  }
}

export class OnboardingNetworkError extends Error {
  constructor() {
    super("온보딩 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "OnboardingNetworkError";
  }
}

export class OnboardingTimeoutError extends Error {
  constructor() {
    super("온보딩 요청 시간이 초과됐습니다.");
    this.name = "OnboardingTimeoutError";
  }
}

export class OnboardingRequestAbortedError extends Error {
  constructor() {
    super("온보딩 요청이 취소됐습니다.");
    this.name = "OnboardingRequestAbortedError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOnboardingTerm(value: unknown): value is OnboardingTerm {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.code === "string" &&
    typeof value.version === "string" &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    typeof value.required === "boolean"
  );
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
  kind: RequestKind,
  signal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, ONBOARDING_REQUEST_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await (kind === "authenticated"
        ? authenticatedFetch(url, { ...init, signal: controller.signal })
        : fetch(url, { ...init, signal: controller.signal }));
    } catch {
      if (signal?.aborted) {
        throw new OnboardingRequestAbortedError();
      }

      if (didTimeout) {
        throw new OnboardingTimeoutError();
      }

      throw new OnboardingNetworkError();
    }

    const body = await parseResponseBody(response);

    if (signal?.aborted) {
      throw new OnboardingRequestAbortedError();
    }

    if (didTimeout) {
      throw new OnboardingTimeoutError();
    }

    if (!response.ok) {
      throw new OnboardingApiError(errorCodeOf(body), response.status);
    }

    return body;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export async function getOnboardingTerms(
  signal?: AbortSignal,
): Promise<OnboardingTerm[]> {
  const body = await requestJson(
    TERMS_ENDPOINT,
    { method: "GET" },
    "public",
    signal,
  );

  if (!Array.isArray(body) || !body.every(isOnboardingTerm)) {
    throw new OnboardingApiError(0, 200);
  }

  return body;
}

export async function agreeToOnboardingTerms(
  termsVersion: string,
  signal?: AbortSignal,
): Promise<string> {
  const body = await requestJson(
    TERMS_AGREEMENT_ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termsVersion, agreed: true }),
    },
    "authenticated",
    signal,
  );

  if (!isRecord(body) || typeof body.accessToken !== "string") {
    throw new OnboardingApiError(0, 200);
  }

  return body.accessToken;
}
