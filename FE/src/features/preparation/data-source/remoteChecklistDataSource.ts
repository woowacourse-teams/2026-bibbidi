import type { AddedChecklistCatalogItemModel } from "../../checklist";
import { isValidLocalDateTime } from "../../../shared/validation/isValidLocalDateTime";

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
  ): Promise<AddedChecklistCatalogItemModel[]>;
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
  constructor(options?: ErrorOptions) {
    super("체크리스트 요청 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteChecklistNetworkError";
  }
}

export class RemoteChecklistTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteChecklistTimeoutError";
  }
}

export class RemoteChecklistRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 요청이 취소됐습니다.", options);
    this.name = "RemoteChecklistRequestAbortedError";
  }
}

export class RemoteChecklistContractError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RemoteChecklistContractError";
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

export function parseAddedChecklistCatalogItems(
  value: unknown,
): AddedChecklistCatalogItemModel[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new RemoteChecklistContractError(
      "체크리스트 추가 성공 응답 형식이 올바르지 않습니다.",
    );
  }

  return value.items.map((item) => {
    if (
      !isRecord(item) ||
      !isValidCatalogItemId(item.id) ||
      !isValidCatalogItemId(item.catalogItemId) ||
      !isValidCatalogItemId(item.categoryId) ||
      !isValidLocalDateTime(item.createdAt) ||
      typeof item.title !== "string" ||
      item.status !== "prev"
    ) {
      throw new RemoteChecklistContractError(
        "체크리스트 추가 성공 응답 형식이 올바르지 않습니다.",
      );
    }

    return {
      catalogItemId: item.catalogItemId,
      categoryId: item.categoryId,
      createdAt: item.createdAt,
      id: item.id,
      status: item.status,
      title: item.title,
    };
  });
}

function parseAddedChecklistCatalogItemsResponse(
  value: unknown,
): AddedChecklistCatalogItemModel[] {
  try {
    return parseAddedChecklistCatalogItems(value);
  } catch (error) {
    if (
      !(error instanceof RemoteChecklistContractError) ||
      !isRecord(value) ||
      !Array.isArray(value.items)
    ) {
      throw error;
    }

    return value.items.map((item) => {
      if (
        !isRecord(item) ||
        "createdAt" in item ||
        !isValidCatalogItemId(item.id) ||
        !isValidCatalogItemId(item.catalogItemId) ||
        !isValidCatalogItemId(item.categoryId) ||
        typeof item.title !== "string" ||
        item.status !== "prev"
      ) {
        throw error;
      }

      return {
        catalogItemId: item.catalogItemId,
        categoryId: item.categoryId,
        createdAt: null,
        id: item.id,
        status: item.status,
        title: item.title,
      };
    });
  }
}

function toRequestError(
  error: unknown,
  didTimeout: boolean,
  callerSignal?: AbortSignal,
): Error {
  if (didTimeout) {
    return new RemoteChecklistTimeoutError({ cause: error });
  }

  if (callerSignal?.aborted) {
    return new RemoteChecklistRequestAbortedError({ cause: error });
  }

  return new RemoteChecklistNetworkError({ cause: error });
}

function createRequestController(signal?: AbortSignal) {
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

  return {
    controller,
    didTimeout: () => didTimeout,
    dispose() {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleCallerAbort);
    },
  };
}

async function addCatalogItemIds(
  catalogItemIds: number[],
  signal?: AbortSignal,
): Promise<AddedChecklistCatalogItemModel[]> {
  const request = createRequestController(signal);

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
        signal: request.controller.signal,
      });
    } catch (error) {
      throw toRequestError(error, request.didTimeout(), signal);
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      if (request.didTimeout() || signal?.aborted) {
        throw toRequestError(error, request.didTimeout(), signal);
      }

      if (!response.ok) {
        throw new RemoteChecklistApiError(0, response.status);
      }

      throw new RemoteChecklistContractError(
        "체크리스트 추가 성공 응답을 해석하지 못했습니다.",
        { cause: error },
      );
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

    const addedItems = parseAddedChecklistCatalogItemsResponse(body);

    if (signal?.aborted) {
      throw new RemoteChecklistRequestAbortedError();
    }

    return addedItems;
  } finally {
    request.dispose();
  }
}

export const remoteChecklistDataSource: RemoteChecklistDataSource = {
  addCatalogItemIds,
};
