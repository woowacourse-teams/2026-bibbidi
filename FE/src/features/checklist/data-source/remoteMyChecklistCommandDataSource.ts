import {
  ChecklistItemStatus,
  isChecklistItemStatus,
} from "../model/myChecklist";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const CHECKLIST_ENDPOINT = `${apiBaseUrl}/api/checklists`;
const CUSTOM_CHECKLIST_ITEM_ENDPOINT = `${CHECKLIST_ENDPOINT}/me/items`;
const CHECKLIST_ITEM_ENDPOINT = `${apiBaseUrl}/api/checklist-items`;
const CHECKLIST_COMMAND_TIMEOUT_MS = 10_000;

interface ApiErrorResponse {
  errorCode: number;
  message: string;
}

export interface RemoteMyChecklistCommandDataSource {
  changeChecklistItemCategory(
    itemId: number,
    categoryId: number,
    signal?: AbortSignal,
  ): Promise<ChecklistItemChangeResponse>;
  changeChecklistItemTitle(
    itemId: number,
    title: string,
    signal?: AbortSignal,
  ): Promise<ChecklistItemChangeResponse>;
  changeChecklistItemStatus(
    itemId: number,
    status: ChecklistItemStatus,
    signal?: AbortSignal,
  ): Promise<ChecklistItemChangeResponse>;
  createChecklist(signal?: AbortSignal): Promise<number>;
  createCustomChecklistItem(
    title: string,
    categoryId: number,
    signal?: AbortSignal,
  ): Promise<CustomChecklistItemCreationResponse>;
  hasRemainingAppointments(
    itemId: number,
    signal?: AbortSignal,
  ): Promise<boolean>;
}

export interface ChecklistItemChangeResponse {
  catalogItemId: number | null;
  categoryId: number;
  id: number;
  status: ChecklistItemStatus;
  title: string;
}

export interface CustomChecklistItemCreationResponse extends Omit<
  ChecklistItemChangeResponse,
  "catalogItemId"
> {
  catalogItemId: null;
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

export class RemoteRemainingAppointmentsApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message = "남은 일정을 확인하지 못했습니다.",
  ) {
    super(message);
    this.name = "RemoteRemainingAppointmentsApiError";
  }
}

export class RemoteRemainingAppointmentsContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("남은 일정 확인 성공 응답 형식이 올바르지 않습니다.", options);
    this.name = "RemoteRemainingAppointmentsContractError";
  }
}

export class RemoteRemainingAppointmentsNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("남은 일정 확인 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteRemainingAppointmentsNetworkError";
  }
}

export class RemoteRemainingAppointmentsTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("남은 일정 확인 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteRemainingAppointmentsTimeoutError";
  }
}

export class RemoteRemainingAppointmentsRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("남은 일정 확인 요청이 취소됐습니다.", options);
    this.name = "RemoteRemainingAppointmentsRequestAbortedError";
  }
}

export class RemoteCustomChecklistItemCreationApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message = "할 일을 추가하지 못했습니다.",
  ) {
    super(message);
    this.name = "RemoteCustomChecklistItemCreationApiError";
  }
}

export class RemoteCustomChecklistItemCreationContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("할 일 추가 성공 응답 형식이 올바르지 않습니다.", options);
    this.name = "RemoteCustomChecklistItemCreationContractError";
  }
}

export class RemoteCustomChecklistItemCreationNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("할 일 추가 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteCustomChecklistItemCreationNetworkError";
  }
}

export class RemoteCustomChecklistItemCreationTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("할 일 추가 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteCustomChecklistItemCreationTimeoutError";
  }
}

export class RemoteCustomChecklistItemCreationRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("할 일 추가 요청이 취소됐습니다.", options);
    this.name = "RemoteCustomChecklistItemCreationRequestAbortedError";
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
    isChecklistItemStatus(value.status)
  );
}

function isCustomChecklistItemCreationResponse(
  value: unknown,
): value is CustomChecklistItemCreationResponse {
  return isChecklistItemChangeResponse(value) && value.catalogItemId === null;
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

function toCustomChecklistItemCreationRequestError(
  error: unknown,
  didTimeout: boolean,
  callerSignal?: AbortSignal,
): Error {
  if (didTimeout) {
    return new RemoteCustomChecklistItemCreationTimeoutError({ cause: error });
  }

  if (callerSignal?.aborted) {
    return new RemoteCustomChecklistItemCreationRequestAbortedError({
      cause: error,
    });
  }

  return new RemoteCustomChecklistItemCreationNetworkError({ cause: error });
}

async function createCustomChecklistItem(
  title: string,
  categoryId: number,
  signal?: AbortSignal,
): Promise<CustomChecklistItemCreationResponse> {
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
      response = await fetch(CUSTOM_CHECKLIST_ITEM_ENDPOINT, {
        body: JSON.stringify({ categoryId, title }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
    } catch (error) {
      throw toCustomChecklistItemCreationRequestError(
        error,
        didTimeout,
        signal,
      );
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      if (didTimeout || signal?.aborted) {
        throw toCustomChecklistItemCreationRequestError(
          error,
          didTimeout,
          signal,
        );
      }

      if (!response.ok) {
        throw new RemoteCustomChecklistItemCreationApiError(0, response.status);
      }

      throw new RemoteCustomChecklistItemCreationContractError({
        cause: error,
      });
    }

    if (didTimeout || signal?.aborted) {
      throw toCustomChecklistItemCreationRequestError(
        new DOMException("aborted", "AbortError"),
        didTimeout,
        signal,
      );
    }

    if (!response.ok) {
      throw new RemoteCustomChecklistItemCreationApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body) ? body.message : undefined,
      );
    }

    if (
      response.status !== 201 ||
      !isCustomChecklistItemCreationResponse(body)
    ) {
      throw new RemoteCustomChecklistItemCreationContractError();
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

async function changeChecklistItem(
  itemId: number,
  property: "category" | "status" | "title",
  requestBody: string,
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
      response = await fetch(
        `${CHECKLIST_ITEM_ENDPOINT}/${itemId}/${property}`,
        {
          body: requestBody,
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PUT",
          signal: controller.signal,
        },
      );
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

    if (didTimeout || signal?.aborted) {
      throw toChecklistItemChangeRequestError(
        new DOMException("aborted", "AbortError"),
        didTimeout,
        signal,
      );
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
      body.id !== itemId ||
      (property === "status" && body.status !== requestBody)
    ) {
      throw new RemoteChecklistItemChangeContractError();
    }

    return body;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

function changeChecklistItemCategory(
  itemId: number,
  categoryId: number,
  signal?: AbortSignal,
) {
  return changeChecklistItem(itemId, "category", String(categoryId), signal);
}

function changeChecklistItemTitle(
  itemId: number,
  title: string,
  signal?: AbortSignal,
) {
  return changeChecklistItem(itemId, "title", title, signal);
}

function changeChecklistItemStatus(
  itemId: number,
  status: ChecklistItemStatus,
  signal?: AbortSignal,
) {
  return changeChecklistItem(itemId, "status", status, signal);
}

function toRemainingAppointmentsRequestError(
  error: unknown,
  didTimeout: boolean,
  callerSignal?: AbortSignal,
): Error {
  if (didTimeout) {
    return new RemoteRemainingAppointmentsTimeoutError({ cause: error });
  }

  if (callerSignal?.aborted) {
    return new RemoteRemainingAppointmentsRequestAbortedError({
      cause: error,
    });
  }

  return new RemoteRemainingAppointmentsNetworkError({ cause: error });
}

async function hasRemainingAppointments(
  itemId: number,
  signal?: AbortSignal,
): Promise<boolean> {
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
      response = await fetch(
        `${CHECKLIST_ITEM_ENDPOINT}/${itemId}/remaining-appointments`,
        {
          credentials: "include",
          method: "GET",
          signal: controller.signal,
        },
      );
    } catch (error) {
      throw toRemainingAppointmentsRequestError(error, didTimeout, signal);
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch (error) {
      if (didTimeout || signal?.aborted) {
        throw toRemainingAppointmentsRequestError(error, didTimeout, signal);
      }

      if (!response.ok) {
        throw new RemoteRemainingAppointmentsApiError(0, response.status);
      }

      throw new RemoteRemainingAppointmentsContractError({ cause: error });
    }

    if (didTimeout || signal?.aborted) {
      throw toRemainingAppointmentsRequestError(
        new DOMException("aborted", "AbortError"),
        didTimeout,
        signal,
      );
    }

    if (!response.ok) {
      throw new RemoteRemainingAppointmentsApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body) ? body.message : undefined,
      );
    }

    if (response.status !== 200 || typeof body !== "boolean") {
      throw new RemoteRemainingAppointmentsContractError();
    }

    return body;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export const remoteMyChecklistCommandDataSource: RemoteMyChecklistCommandDataSource =
  {
    changeChecklistItemCategory,
    changeChecklistItemStatus,
    changeChecklistItemTitle,
    createChecklist,
    createCustomChecklistItem,
    hasRemainingAppointments,
  };
