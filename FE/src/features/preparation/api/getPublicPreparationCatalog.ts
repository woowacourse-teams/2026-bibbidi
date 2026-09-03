import { PreparationCatalogModel } from "../model/preparationRoadmap";
import { parsePreparationCatalogResponse } from "./preparationCatalogResponse";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const PUBLIC_CATALOG_ENDPOINT = `${apiBaseUrl}/api/catalog/public`;
const PUBLIC_CATALOG_TIMEOUT_MS = 10_000;

export class PublicPreparationCatalogApiError extends Error {
  constructor(readonly status: number) {
    super("준비 목록을 불러오지 못했습니다.");
    this.name = "PublicPreparationCatalogApiError";
  }
}

export class PublicPreparationCatalogNetworkError extends Error {
  constructor() {
    super("준비 목록 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "PublicPreparationCatalogNetworkError";
  }
}

export class PublicPreparationCatalogTimeoutError extends Error {
  constructor() {
    super("준비 목록 요청 시간이 초과됐습니다.");
    this.name = "PublicPreparationCatalogTimeoutError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toRequestError(error: unknown, didTimeout: boolean): Error {
  if (didTimeout) {
    return new PublicPreparationCatalogTimeoutError();
  }

  if (isRecord(error) && error.name === "AbortError") {
    return new PublicPreparationCatalogNetworkError();
  }

  return new PublicPreparationCatalogNetworkError();
}

export async function getPublicPreparationCatalog(
  signal?: AbortSignal,
): Promise<PreparationCatalogModel> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, PUBLIC_CATALOG_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await fetch(PUBLIC_CATALOG_ENDPOINT, {
        method: "GET",
        signal: controller.signal,
      });
    } catch (error) {
      throw toRequestError(error, didTimeout);
    }

    if (!response.ok) {
      throw new PublicPreparationCatalogApiError(response.status);
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

      throw new Error("준비 목록 성공 응답을 해석하지 못했습니다.", {
        cause: error,
      });
    }

    return parsePreparationCatalogResponse(body);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}
