const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 10_000;

export interface AppointmentCreationRequest {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  place: string | null;
  memo: string | null;
}

export interface AppointmentConflictResponse {
  appointmentId: number;
  checklistItemId: number;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  place: string | null;
}

export interface AppointmentCreationResponse extends AppointmentCreationRequest {
  id: number;
  checklistItemId: number;
  isDone: boolean;
  conflicts: AppointmentConflictResponse[];
}

export class RemoteAppointmentCreationApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: number,
  ) {
    super("일정을 저장하지 못했습니다.");
    this.name = "RemoteAppointmentCreationApiError";
  }
}

export class RemoteAppointmentCreationContractError extends Error {
  constructor(
    readonly stage: "request" | "response",
    options?: ErrorOptions,
  ) {
    super("일정 생성 계약이 올바르지 않습니다.", options);
    this.name = "RemoteAppointmentCreationContractError";
  }
}

export class RemoteAppointmentCreationNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정 생성 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteAppointmentCreationNetworkError";
  }
}

export class RemoteAppointmentCreationTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정 생성 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteAppointmentCreationTimeoutError";
  }
}

export class RemoteAppointmentCreationRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정 생성 요청이 취소됐습니다.", options);
    this.name = "RemoteAppointmentCreationRequestAbortedError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
  );
}

function isLocalDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?$/.exec(value);
  return (
    match !== null &&
    isDate(match[1]) &&
    Number(match[2]) <= 23 &&
    Number(match[3]) <= 59 &&
    Number(match[4]) <= 59
  );
}

function isNullableTime(value: unknown): value is string | null {
  return value === null || isLocalDateTime(value);
}

function isNullableText(
  value: unknown,
  maxLength?: number,
): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      (maxLength === undefined || value.length <= maxLength))
  );
}

function isTitle(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 255
  );
}

function isTimeRangeValid(start: string | null, end: string | null): boolean {
  return start === null || end === null || start <= end;
}

export function isAppointmentRequest(
  value: unknown,
): value is AppointmentCreationRequest {
  return (
    isRecord(value) &&
    isTitle(value.title) &&
    isDate(value.date) &&
    isNullableTime(value.startTime) &&
    isNullableTime(value.endTime) &&
    isNullableText(value.place, 255) &&
    isNullableText(value.memo) &&
    isTimeRangeValid(value.startTime, value.endTime)
  );
}

function isConflict(value: unknown): value is AppointmentConflictResponse {
  return (
    isRecord(value) &&
    isId(value.appointmentId) &&
    isId(value.checklistItemId) &&
    isTitle(value.title) &&
    isDate(value.date) &&
    isNullableTime(value.startTime) &&
    isNullableTime(value.endTime) &&
    isNullableText(value.place, 255) &&
    isTimeRangeValid(value.startTime, value.endTime)
  );
}

export function isAppointmentResponse(
  value: unknown,
  checklistItemId: number,
): value is AppointmentCreationResponse {
  return (
    isRecord(value) &&
    isId(value.id) &&
    value.checklistItemId === checklistItemId &&
    isAppointmentRequest(value) &&
    typeof value.isDone === "boolean" &&
    Array.isArray(value.conflicts) &&
    value.conflicts.every(isConflict)
  );
}

function toRequestError(
  error: unknown,
  timedOut: boolean,
  signal?: AbortSignal,
): Error {
  if (signal?.aborted)
    return new RemoteAppointmentCreationRequestAbortedError({ cause: error });
  if (timedOut)
    return new RemoteAppointmentCreationTimeoutError({ cause: error });
  return new RemoteAppointmentCreationNetworkError({ cause: error });
}

export async function createRemoteAppointment(
  checklistItemId: unknown,
  request: unknown,
  signal?: AbortSignal,
): Promise<AppointmentCreationResponse> {
  if (!isId(checklistItemId) || !isAppointmentRequest(request)) {
    throw new RemoteAppointmentCreationContractError("request");
  }

  if (signal?.aborted) throw new RemoteAppointmentCreationRequestAbortedError();
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(
        `${apiBaseUrl}/api/checklist-items/${checklistItemId}/appointments`,
        {
          body: JSON.stringify({
            title: request.title,
            date: request.date,
            startTime: request.startTime,
            endTime: request.endTime,
            place: request.place,
            memo: request.memo,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        },
      );
    } catch (error) {
      throw toRequestError(error, timedOut, signal);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (signal?.aborted || timedOut)
        throw toRequestError(error, timedOut, signal);
      if (!response.ok)
        throw new RemoteAppointmentCreationApiError(response.status, 0);
      throw new RemoteAppointmentCreationContractError("response", {
        cause: error,
      });
    }

    if (signal?.aborted || timedOut) {
      throw toRequestError(
        new DOMException("aborted", "AbortError"),
        timedOut,
        signal,
      );
    }
    if (!response.ok) {
      const errorCode =
        isRecord(body) && typeof body.errorCode === "number"
          ? body.errorCode
          : 0;
      throw new RemoteAppointmentCreationApiError(response.status, errorCode);
    }
    if (
      response.status !== 201 ||
      !isAppointmentResponse(body, checklistItemId)
    ) {
      throw new RemoteAppointmentCreationContractError("response");
    }
    return body;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abort);
  }
}
