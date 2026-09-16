const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const CHECKLIST_ENDPOINT = `${apiBaseUrl}/api/checklists`;
const CHECKLIST_ITEM_ENDPOINT = `${apiBaseUrl}/api/checklist-items`;
const CHECKLIST_COMMAND_TIMEOUT_MS = 10_000;

interface ApiErrorResponse {
  errorCode: number;
  message: string;
}

export interface RemoteMyChecklistCommandDataSource {
  changeChecklistItemTitle(
    itemId: number,
    title: string,
    signal?: AbortSignal,
  ): Promise<ChecklistItemChangeResponse>;
  createChecklist(signal?: AbortSignal): Promise<number>;
}

export interface ChecklistItemChangeResponse {
  catalogItemId: number | null;
  categoryId: number;
  id: number;
  status: "continue" | "done" | "prev";
  title: string;
}

export class RemoteMyChecklistCreationApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message = "체크리스트를 생성하지 못했습니다.",
  ) {
    super(message);
    this.name = "RemoteMyChecklistCreationApiError";
  }
}

export class RemoteMyChecklistCreationContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 생성 성공 응답 형식이 올바르지 않습니다.", options);
    this.name = "RemoteMyChecklistCreationContractError";
  }
}

export class RemoteMyChecklistCreationNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 생성 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteMyChecklistCreationNetworkError";
  }
}

export class RemoteMyChecklistCreationTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 생성 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteMyChecklistCreationTimeoutError";
  }
}

export class RemoteMyChecklistCreationRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("체크리스트 생성 요청이 취소됐습니다.", options);
    this.name = "RemoteMyChecklistCreationRequestAbortedError";
  }
}

export class RemoteChecklistItemChangeApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message = "할 일을 수정하지 못했습니다.",
  ) {
    super(message);
    this.name = "RemoteChecklistItemChangeApiError";
  }
}

export class RemoteChecklistItemChangeContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("할 일 수정 성공 응답 형식이 올바르지 않습니다.", options);
    this.name = "RemoteChecklistItemChangeContractError";
  }
}

export class RemoteChecklistItemChangeNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("할 일 수정 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteChecklistItemChangeNetworkError";
  }
}

export class RemoteChecklistItemChangeTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("할 일 수정 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteChecklistItemChangeTimeoutError";
  }
}

export class RemoteChecklistItemChangeRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("할 일 수정 요청이 취소됐습니다.", options);
    this.name = "RemoteChecklistItemChangeRequestAbortedError";
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

function isValidChecklistId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isChecklistItemChangeResponse(
  value: unknown,
): value is ChecklistItemChangeResponse {
  return (
    isRecord(value) &&
    isValidChecklistId(value.id) &&
    (value.catalogItemId === null || isValidChecklistId(value.catalogItemId)) &&
    isValidChecklistId(value.categoryId) &&
    typeof value.title === "string" &&
    (value.status === "prev" ||
      value.status === "continue" ||
      value.status === "done")
  );
}

function toRequestError(
  error: unknown,
  didTimeout: boolean,
  callerSignal?: AbortSignal,
): Error {
  if (didTimeout) {
    return new RemoteMyChecklistCreationTimeoutError({ cause: error });
  }

  if (callerSignal?.aborted) {
    return new RemoteMyChecklistCreationRequestAbortedError({ cause: error });
  }

  return new RemoteMyChecklistCreationNetworkError({ cause: error });
}

async function createChecklist(signal?: AbortSignal): Promise<number> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, CHECKLIST_COMMAND_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await fetch(CHECKLIST_ENDPOINT, {
        credentials: "include",
        method: "POST",
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
        throw new RemoteMyChecklistCreationApiError(0, response.status);
      }

      throw new RemoteMyChecklistCreationContractError({ cause: error });
    }

    if (!response.ok) {
      throw new RemoteMyChecklistCreationApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body)
          ? body.message
          : "체크리스트를 생성하지 못했습니다.",
      );
    }

    if (response.status !== 201 || !isValidChecklistId(body)) {
      throw new RemoteMyChecklistCreationContractError();
    }

    return body;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

function toChecklistItemChangeRequestError(
  error: unknown,
  didTimeout: boolean,
  callerSignal?: AbortSignal,
): Error {
  if (didTimeout) {
    return new RemoteChecklistItemChangeTimeoutError({ cause: error });
  }

  if (callerSignal?.aborted) {
    return new RemoteChecklistItemChangeRequestAbortedError({ cause: error });
  }

  return new RemoteChecklistItemChangeNetworkError({ cause: error });
}

async function changeChecklistItemTitle(
  itemId: number,
  title: string,
  signal?: AbortSignal,
): Promise<ChecklistItemChangeResponse> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, CHECKLIST_COMMAND_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await fetch(`${CHECKLIST_ITEM_ENDPOINT}/${itemId}/title`, {
        body: title,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
        signal: controller.signal,
      });
    } catch (error) {
      throw toChecklistItemChangeRequestError(error, didTimeout, signal);
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      if (didTimeout || signal?.aborted) {
        throw toChecklistItemChangeRequestError(error, didTimeout, signal);
      }

      if (!response.ok) {
        throw new RemoteChecklistItemChangeApiError(0, response.status);
      }

      throw new RemoteChecklistItemChangeContractError({ cause: error });
    }

    if (!response.ok) {
      throw new RemoteChecklistItemChangeApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body) ? body.message : undefined,
      );
    }

    if (
      response.status !== 200 ||
      !isChecklistItemChangeResponse(body) ||
      body.id !== itemId
    ) {
      throw new RemoteChecklistItemChangeContractError();
    }

    return body;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export const remoteMyChecklistCommandDataSource: RemoteMyChecklistCommandDataSource =
  { changeChecklistItemTitle, createChecklist };
