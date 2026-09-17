import { CatalogModel } from "../model/catalog";
import { parseCatalogResponse } from "./catalogResponse";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const CATALOG_ENDPOINT = `${apiBaseUrl}/api/catalog`;
const CATALOG_REQUEST_TIMEOUT_MS = 10_000;

interface ApiErrorResponse {
  errorCode: number;
  message: string;
}

export class RemoteCatalogApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message = "Catalog를 불러오지 못했습니다.",
  ) {
    super(message);
    this.name = "RemoteCatalogApiError";
  }
}

export class RemoteCatalogNetworkError extends Error {
  constructor() {
    super("Catalog 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "RemoteCatalogNetworkError";
  }
}

export class RemoteCatalogTimeoutError extends Error {
  constructor() {
    super("Catalog 요청 시간이 초과됐습니다.");
    this.name = "RemoteCatalogTimeoutError";
  }
}

export class RemoteCatalogRequestAbortedError extends Error {
  constructor() {
    super("Catalog 요청이 취소됐습니다.");
    this.name = "RemoteCatalogRequestAbortedError";
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

function toRequestError(
  error: unknown,
  didTimeout: boolean,
  callerSignal?: AbortSignal,
): Error {
  if (didTimeout) {
    return new RemoteCatalogTimeoutError();
  }

  if (callerSignal?.aborted) {
    return new RemoteCatalogRequestAbortedError();
  }

  if (isRecord(error) && error.name === "AbortError") {
    return new RemoteCatalogNetworkError();
  }

  return new RemoteCatalogNetworkError();
}

async function getCatalog(signal?: AbortSignal) {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, CATALOG_REQUEST_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await fetch(CATALOG_ENDPOINT, {
        credentials: "omit",
        method: "GET",
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
        (isRecord(error) && error.name === "AbortError") ||
        error instanceof TypeError
      ) {
        throw toRequestError(error, didTimeout, signal);
      }

      if (!response.ok) {
        throw new RemoteCatalogApiError(0, response.status);
      }

      throw new Error("준비 목록 성공 응답을 해석하지 못했습니다.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new RemoteCatalogApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body)
          ? body.message
          : "Catalog를 불러오지 못했습니다.",
      );
    }

    return parseCatalogResponse(body);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export const remoteCatalogDataSource = {
  getCatalog(signal?: AbortSignal): Promise<CatalogModel> {
    return getCatalog(signal);
  },
};
