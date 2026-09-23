import {
  isChecklistItemStatus,
  MyChecklistAppointmentModel,
  MyChecklistModel,
} from "../model/myChecklist";
import { isValidLocalDateTime } from "../../../shared/validation/isValidLocalDateTime";

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

function isValidId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

function parseAppointment(value: unknown): MyChecklistAppointmentModel {
  if (
    !isRecord(value) ||
    !isValidId(value.id) ||
    typeof value.title !== "string" ||
    !isValidDate(value.date) ||
    !isNullableString(value.startTime) ||
    !isNullableString(value.endTime) ||
    !isNullableString(value.place) ||
    !isNullableString(value.memo) ||
    typeof value.isDone !== "boolean"
  ) {
    throw new RemoteMyChecklistContractError();
  }

  return {
    date: value.date,
    endTime: value.endTime,
    id: value.id,
    isDone: value.isDone,
    memo: value.memo,
    place: value.place,
    startTime: value.startTime,
    title: value.title,
  };
}

function parseSourceCatalogItemId(
  item: Record<string, unknown>,
): number | null {
  const sourceCatalogItemId =
    "sourceCatalogItemId" in item
      ? item.sourceCatalogItemId
      : item.catalogItemId;

  if (
    sourceCatalogItemId !== null &&
    !isValidCatalogItemId(sourceCatalogItemId)
  ) {
    throw new RemoteMyChecklistContractError();
  }

  return sourceCatalogItemId;
}

export function parseMyChecklist(value: unknown): MyChecklistModel {
  if (!isRecord(value) || !isValidId(value.id) || !Array.isArray(value.items)) {
    throw new RemoteMyChecklistContractError();
  }

  return {
    exists: true,
    items: value.items.map((item) => {
      if (
        !isRecord(item) ||
        !isValidId(item.id) ||
        !isValidId(item.categoryId) ||
        !isValidLocalDateTime(item.createdAt) ||
        typeof item.title !== "string" ||
        !isChecklistItemStatus(item.status) ||
        !Array.isArray(item.appointments) ||
        (!("sourceCatalogItemId" in item) && !("catalogItemId" in item))
      ) {
        throw new RemoteMyChecklistContractError();
      }

      return {
        appointments: item.appointments.map(parseAppointment),
        categoryId: item.categoryId,
        createdAt: item.createdAt,
        id: item.id,
        sourceCatalogItemId: parseSourceCatalogItemId(item),
        status: item.status,
        title: item.title,
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
