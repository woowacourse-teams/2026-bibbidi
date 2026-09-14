const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const MY_CHECKLIST_ENDPOINT = `${apiBaseUrl}/api/checklists/me`;
const ADD_CHECKLIST_CATALOG_ITEMS_ENDPOINT = `${MY_CHECKLIST_ENDPOINT}/catalog-items`;
const CHECKLIST_REQUEST_TIMEOUT_MS = 10_000;

interface ApiErrorResponse {
  errorCode: number;
  message: string;
}

export interface RemoteChecklistDataSource {
  addCatalogItemIds(
    catalogItemIds: number[],
    signal?: AbortSignal,
  ): Promise<number[]>;
  getCatalogItemIds(signal?: AbortSignal): Promise<number[]>;
}

export class RemoteChecklistApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message = "체크리스트를 불러오지 못했습니다.",
  ) {
    super(message);
    this.name = "RemoteChecklistApiError";
  }
}

export class RemoteChecklistNetworkError extends Error {
  constructor() {
    super("체크리스트 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "RemoteChecklistNetworkError";
  }
}

export class RemoteChecklistTimeoutError extends Error {
  constructor() {
    super("체크리스트 요청 시간이 초과됐습니다.");
    this.name = "RemoteChecklistTimeoutError";
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

function isValidCatalogItemId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function getSourceCatalogItemId(item: Record<string, unknown>): unknown {
  return item.sourceCatalogItemId ?? item.catalogItemId;
}

export function parseChecklistCatalogItemIds(value: unknown): number[] {
  if (!isRecord(value) || typeof value.id !== "number") {
    throw new Error("체크리스트 성공 응답 형식이 올바르지 않습니다.");
  }

  const items = value.items ?? [];

  if (!Array.isArray(items) || items.some((item) => !isRecord(item))) {
    throw new Error("체크리스트 성공 응답 형식이 올바르지 않습니다.");
  }

  const catalogItemIds = items.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const catalogItemId = getSourceCatalogItemId(item);

    if (catalogItemId === undefined || catalogItemId === null) {
      return [];
    }

    if (!isValidCatalogItemId(catalogItemId)) {
      throw new Error("체크리스트 성공 응답 형식이 올바르지 않습니다.");
    }

    return [catalogItemId];
  });

  return [...new Set(catalogItemIds)];
}

export function parseAddedChecklistCatalogItemIds(value: unknown): number[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("체크리스트 추가 성공 응답 형식이 올바르지 않습니다.");
  }

  const catalogItemIds = value.items.map((item) => {
    if (!isRecord(item) || !isValidCatalogItemId(item.catalogItemId)) {
      throw new Error("체크리스트 추가 성공 응답 형식이 올바르지 않습니다.");
    }

    return item.catalogItemId;
  });

  return [...new Set(catalogItemIds)];
}

function toRequestError(didTimeout: boolean): Error {
  if (didTimeout) {
    return new RemoteChecklistTimeoutError();
  }

  return new RemoteChecklistNetworkError();
}

async function getCatalogItemIds(signal?: AbortSignal): Promise<number[]> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, CHECKLIST_REQUEST_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await fetch(MY_CHECKLIST_ENDPOINT, {
        credentials: "include",
        method: "GET",
        signal: controller.signal,
      });
    } catch {
      throw toRequestError(didTimeout);
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      if (didTimeout || error instanceof TypeError) {
        throw toRequestError(didTimeout);
      }

      if (!response.ok) {
        throw new RemoteChecklistApiError(0, response.status);
      }

      throw new Error("체크리스트 성공 응답을 해석하지 못했습니다.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new RemoteChecklistApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body)
          ? body.message
          : "체크리스트를 불러오지 못했습니다.",
      );
    }

    return parseChecklistCatalogItemIds(body);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

async function addCatalogItemIds(
  catalogItemIds: number[],
  signal?: AbortSignal,
): Promise<number[]> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, CHECKLIST_REQUEST_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await fetch(ADD_CHECKLIST_CATALOG_ITEMS_ENDPOINT, {
        body: JSON.stringify(catalogItemIds),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      });
    } catch {
      throw toRequestError(didTimeout);
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      if (didTimeout || error instanceof TypeError) {
        throw toRequestError(didTimeout);
      }

      if (!response.ok) {
        throw new RemoteChecklistApiError(0, response.status);
      }

      throw new Error("체크리스트 추가 성공 응답을 해석하지 못했습니다.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new RemoteChecklistApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body)
          ? body.message
          : "체크리스트에 할 일을 추가하지 못했습니다.",
      );
    }

    return parseAddedChecklistCatalogItemIds(body);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export const remoteChecklistDataSource: RemoteChecklistDataSource = {
  addCatalogItemIds,
  getCatalogItemIds,
};
