const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const RECOMMENDED_CATALOG_ITEMS_ENDPOINT = `${apiBaseUrl}/api/checklists/me/recommended-catalog-items`;
const RECOMMENDED_CATALOG_ITEMS_REQUEST_TIMEOUT_MS = 10_000;

interface ApiErrorResponse {
  errorCode: number;
  message: string;
}

export interface RecommendedCatalogItemResponse {
  categoryName: string;
  catalogItemId: number;
  phase: number;
  stepName: string;
  title: string;
}

export interface RemoteRecommendedCatalogItemsDataSource {
  getRecommendedCatalogItems(
    limit: number,
    signal?: AbortSignal,
  ): Promise<RecommendedCatalogItemResponse[]>;
}

export class RemoteRecommendedCatalogItemsApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message = "추천 할 일을 불러오지 못했습니다.",
  ) {
    super(message);
    this.name = "RemoteRecommendedCatalogItemsApiError";
  }
}

export class RemoteRecommendedCatalogItemsContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("추천 할 일 성공 응답 형식이 올바르지 않습니다.", options);
    this.name = "RemoteRecommendedCatalogItemsContractError";
  }
}

export class RemoteRecommendedCatalogItemsNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("추천 할 일 요청 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteRecommendedCatalogItemsNetworkError";
  }
}

export class RemoteRecommendedCatalogItemsTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("추천 할 일 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteRecommendedCatalogItemsTimeoutError";
  }
}

export class RemoteRecommendedCatalogItemsRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("추천 할 일 요청이 취소됐습니다.", options);
    this.name = "RemoteRecommendedCatalogItemsRequestAbortedError";
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

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parseRecommendedCatalogItem(
  value: unknown,
): RecommendedCatalogItemResponse {
  if (
    !isRecord(value) ||
    !isPositiveSafeInteger(value.catalogItemId) ||
    typeof value.title !== "string" ||
    typeof value.categoryName !== "string" ||
    !isPositiveSafeInteger(value.phase) ||
    typeof value.stepName !== "string"
  ) {
    throw new RemoteRecommendedCatalogItemsContractError();
  }

  return {
    categoryName: value.categoryName,
    catalogItemId: value.catalogItemId,
    phase: value.phase,
    stepName: value.stepName,
    title: value.title,
  };
}

export function parseRecommendedCatalogItems(
  value: unknown,
  maximumLength: number,
): RecommendedCatalogItemResponse[] {
  if (!Array.isArray(value) || value.length > maximumLength) {
    throw new RemoteRecommendedCatalogItemsContractError();
  }

  return value.map(parseRecommendedCatalogItem);
}

function toRequestError(
  error: unknown,
  didTimeout: boolean,
  callerSignal?: AbortSignal,
): Error {
  if (didTimeout) {
    return new RemoteRecommendedCatalogItemsTimeoutError({ cause: error });
  }

  if (callerSignal?.aborted) {
    return new RemoteRecommendedCatalogItemsRequestAbortedError({
      cause: error,
    });
  }

  return new RemoteRecommendedCatalogItemsNetworkError({ cause: error });
}

async function getRecommendedCatalogItems(
  limit: number,
  signal?: AbortSignal,
): Promise<RecommendedCatalogItemResponse[]> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, RECOMMENDED_CATALOG_ITEMS_REQUEST_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await fetch(
        `${RECOMMENDED_CATALOG_ITEMS_ENDPOINT}?limit=${encodeURIComponent(limit)}`,
        {
          credentials: "include",
          method: "GET",
          signal: controller.signal,
        },
      );
    } catch (error) {
      throw toRequestError(error, didTimeout, signal);
    }

    if (didTimeout || signal?.aborted) {
      throw toRequestError(undefined, didTimeout, signal);
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
        throw new RemoteRecommendedCatalogItemsApiError(0, response.status);
      }

      throw new RemoteRecommendedCatalogItemsContractError({ cause: error });
    }

    if (didTimeout || signal?.aborted) {
      throw toRequestError(undefined, didTimeout, signal);
    }

    if (!response.ok) {
      throw new RemoteRecommendedCatalogItemsApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body)
          ? body.message
          : "추천 할 일을 불러오지 못했습니다.",
      );
    }

    return parseRecommendedCatalogItems(body, limit);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export const remoteRecommendedCatalogItemsDataSource: RemoteRecommendedCatalogItemsDataSource =
  {
    getRecommendedCatalogItems,
  };
