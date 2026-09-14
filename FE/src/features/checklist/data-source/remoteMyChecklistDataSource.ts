import { MyChecklistModel } from "../model/myChecklist";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const MY_CHECKLIST_ENDPOINT = `${apiBaseUrl}/api/checklists/me`;
const MY_CHECKLIST_REQUEST_TIMEOUT_MS = 10_000;

interface ApiErrorResponse {
  errorCode: number;
  message: string;
}

export interface RemoteMyChecklistDataSource {
  getChecklist(signal?: AbortSignal): Promise<MyChecklistModel>;
}

export class RemoteMyChecklistApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message = "체크리스트를 불러오지 못했습니다.",
  ) {
    super(message);
    this.name = "RemoteMyChecklistApiError";
  }
}

export class RemoteMyChecklistContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 성공 응답 형식이 올바르지 않습니다.", options);
    this.name = "RemoteMyChecklistContractError";
  }
}

export class RemoteMyChecklistNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 요청 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteMyChecklistNetworkError";
  }
}

export class RemoteMyChecklistTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteMyChecklistTimeoutError";
  }
}

export class RemoteMyChecklistRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 요청이 취소됐습니다.", options);
    this.name = "RemoteMyChecklistRequestAbortedError";
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

function parseSourceCatalogItemId(
  item: Record<string, unknown>,
): number | null {
  const sourceCatalogItemId =
    item.sourceCatalogItemId ?? item.catalogItemId ?? null;

  if (
    sourceCatalogItemId !== null &&
    !isValidCatalogItemId(sourceCatalogItemId)
  ) {
    throw new RemoteMyChecklistContractError();
  }

  return sourceCatalogItemId;
}

export function parseMyChecklist(value: unknown): MyChecklistModel {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    !Array.isArray(value.items) ||
    value.items.some(
      (item) => !isRecord(item) || typeof item.isDone !== "boolean",
    )
  ) {
    throw new RemoteMyChecklistContractError();
  }

  return {
    items: value.items.map((item) => {
      const checklistItem = item as Record<string, unknown>;

      return {
        isDone: checklistItem.isDone as boolean,
        sourceCatalogItemId: parseSourceCatalogItemId(checklistItem),
      };
    }),
  };
}

function toRequestError(
  error: unknown,
  didTimeout: boolean,
  callerSignal?: AbortSignal,
): Error {
  if (didTimeout) {
    return new RemoteMyChecklistTimeoutError({ cause: error });
  }

  if (callerSignal?.aborted) {
    return new RemoteMyChecklistRequestAbortedError({ cause: error });
  }

  return new RemoteMyChecklistNetworkError({ cause: error });
}

async function getChecklist(signal?: AbortSignal): Promise<MyChecklistModel> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, MY_CHECKLIST_REQUEST_TIMEOUT_MS);

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
    } catch (error) {
      throw toRequestError(error, didTimeout, signal);
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      if (didTimeout || signal?.aborted) {
        throw toRequestError(error, didTimeout, signal);
      }

      if (!response.ok) {
        throw new RemoteMyChecklistApiError(0, response.status);
      }

      throw new RemoteMyChecklistContractError({ cause: error });
    }

    if (!response.ok) {
      throw new RemoteMyChecklistApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body)
          ? body.message
          : "체크리스트를 불러오지 못했습니다.",
      );
    }

    return parseMyChecklist(body);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export const remoteMyChecklistDataSource: RemoteMyChecklistDataSource = {
  getChecklist,
};
