import { PreparationCatalogModel } from "../model/preparationRoadmap";
import { parsePreparationCatalogResponse } from "./preparationCatalogResponse";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const AUTHENTICATED_CATALOG_ENDPOINT = `${apiBaseUrl}/api/catalog`;
const PUBLIC_CATALOG_ENDPOINT = `${apiBaseUrl}/api/catalog/public`;
const CATALOG_REQUEST_TIMEOUT_MS = 10_000;

interface ApiErrorResponse {
  errorCode: number;
  message: string;
}

export class RemotePreparationCatalogApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message = "준비 목록을 불러오지 못했습니다.",
  ) {
    super(message);
    this.name = "RemotePreparationCatalogApiError";
  }
}

export class RemotePreparationCatalogNetworkError extends Error {
  constructor() {
    super("준비 목록 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "RemotePreparationCatalogNetworkError";
  }
}

export class RemotePreparationCatalogTimeoutError extends Error {
  constructor() {
    super("준비 목록 요청 시간이 초과됐습니다.");
    this.name = "RemotePreparationCatalogTimeoutError";
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

function toRequestError(error: unknown, didTimeout: boolean): Error {
  if (didTimeout) {
    return new RemotePreparationCatalogTimeoutError();
  }

  if (isRecord(error) && error.name === "AbortError") {
    return new RemotePreparationCatalogNetworkError();
  }

  return new RemotePreparationCatalogNetworkError();
}

async function getPreparationCatalog(
  endpoint: string,
  requiresAuthentication: boolean,
  signal?: AbortSignal,
) {
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
      response = await fetch(endpoint, {
        credentials: requiresAuthentication ? "include" : "omit",
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
        throw new RemotePreparationCatalogApiError(0, response.status);
      }

      throw new Error("준비 목록 성공 응답을 해석하지 못했습니다.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new RemotePreparationCatalogApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body)
          ? body.message
          : "준비 목록을 불러오지 못했습니다.",
      );
    }

    return parsePreparationCatalogResponse(body);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export const remotePreparationCatalogDataSource = {
  getAuthenticatedCatalog(
    signal?: AbortSignal,
  ): Promise<PreparationCatalogModel> {
    return getPreparationCatalog(AUTHENTICATED_CATALOG_ENDPOINT, true, signal);
  },
  getPublicCatalog(signal?: AbortSignal): Promise<PreparationCatalogModel> {
    return getPreparationCatalog(PUBLIC_CATALOG_ENDPOINT, false, signal);
  },
};
