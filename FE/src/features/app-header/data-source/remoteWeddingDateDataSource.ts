import { authenticatedFetch } from "../../../infrastructure/http/authenticatedFetch";
import { isValidWeddingDate } from "../model/weddingDate";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const WEDDING_DATE_ENDPOINT = `${apiBaseUrl}/api/users/me/wedding-date`;
const REQUEST_TIMEOUT_MS = 10_000;

export interface RemoteWeddingDateDataSource {
  getWeddingDate(signal?: AbortSignal): Promise<string | null>;
  saveWeddingDate(date: string, signal?: AbortSignal): Promise<string>;
}

export class RemoteWeddingDateApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: number,
  ) {
    super("결혼 예정일 요청에 실패했습니다.");
    this.name = "RemoteWeddingDateApiError";
  }
}

export class RemoteWeddingDateContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("결혼 예정일 응답 형식이 올바르지 않습니다.", options);
    this.name = "RemoteWeddingDateContractError";
  }
}

export class RemoteWeddingDateNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("결혼 예정일 요청 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteWeddingDateNetworkError";
  }
}

export class RemoteWeddingDateTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("결혼 예정일 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteWeddingDateTimeoutError";
  }
}

export class RemoteWeddingDateRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("결혼 예정일 요청이 취소됐습니다.", options);
    this.name = "RemoteWeddingDateRequestAbortedError";
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

export function parseWeddingDateResponse(value: unknown): string | null {
  if (
    !isRecord(value) ||
    !(value.weddingDate === null || isValidWeddingDate(value.weddingDate))
  ) {
    throw new RemoteWeddingDateContractError();
  }

  return value.weddingDate;
}

function toRequestError(
  error: unknown,
  didTimeout: boolean,
  callerSignal?: AbortSignal,
): Error {
  if (didTimeout) {
    return new RemoteWeddingDateTimeoutError({ cause: error });
  }
  if (callerSignal?.aborted) {
    return new RemoteWeddingDateRequestAbortedError({ cause: error });
  }
  return new RemoteWeddingDateNetworkError({ cause: error });
}

async function requestWeddingDate(
  method: "GET" | "PUT",
  date?: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;
    try {
      response = await authenticatedFetch(WEDDING_DATE_ENDPOINT, {
        credentials: "include",
        method,
        ...(method === "PUT"
          ? {
              body: JSON.stringify({ weddingDate: date }),
              headers: { "Content-Type": "application/json" },
            }
          : {}),
        signal: controller.signal,
      });
    } catch (error) {
      throw toRequestError(error, didTimeout, signal);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (
        didTimeout ||
        signal?.aborted ||
        error instanceof TypeError ||
        (isRecord(error) && error.name === "AbortError")
      ) {
        throw toRequestError(error, didTimeout, signal);
      }
      if (!response.ok) {
        throw new RemoteWeddingDateApiError(response.status, 0);
      }
      throw new RemoteWeddingDateContractError({ cause: error });
    }

    if (signal?.aborted || controller.signal.aborted) {
      throw toRequestError(undefined, didTimeout, signal);
    }
    if (!response.ok) {
      throw new RemoteWeddingDateApiError(response.status, errorCodeOf(body));
    }
    return parseWeddingDateResponse(body);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export const remoteWeddingDateDataSource: RemoteWeddingDateDataSource = {
  getWeddingDate: (signal) => requestWeddingDate("GET", undefined, signal),
  async saveWeddingDate(date, signal) {
    if (!isValidWeddingDate(date)) {
      throw new RemoteWeddingDateContractError();
    }
    const savedDate = await requestWeddingDate("PUT", date, signal);
    if (savedDate === null) {
      throw new RemoteWeddingDateContractError();
    }
    return savedDate;
  },
};
