const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const NEARBY_APPOINTMENTS_ENDPOINT = `${apiBaseUrl}/api/appointments/me/nearby`;
const NEARBY_APPOINTMENTS_REQUEST_TIMEOUT_MS = 10_000;

interface ApiErrorResponse {
  errorCode: number;
  message: string;
}

export interface NearbyAppointmentResponse {
  checklistItemId: number;
  date: string;
  endTime: string | null;
  id: number;
  isDone: false;
  memo: string | null;
  place: string | null;
  startTime: string | null;
  title: string;
}

export interface RemoteNearbyAppointmentsDataSource {
  getNearbyAppointments(
    limit: number,
    signal?: AbortSignal,
  ): Promise<NearbyAppointmentResponse[]>;
}

export class RemoteNearbyAppointmentsApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message = "가까운 일정을 불러오지 못했습니다.",
  ) {
    super(message);
    this.name = "RemoteNearbyAppointmentsApiError";
  }
}

export class RemoteNearbyAppointmentsContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("가까운 일정 성공 응답 형식이 올바르지 않습니다.", options);
    this.name = "RemoteNearbyAppointmentsContractError";
  }
}

export class RemoteNearbyAppointmentsNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("가까운 일정 요청 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteNearbyAppointmentsNetworkError";
  }
}

export class RemoteNearbyAppointmentsTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("가까운 일정 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteNearbyAppointmentsTimeoutError";
  }
}

export class RemoteNearbyAppointmentsRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("가까운 일정 요청이 취소됐습니다.", options);
    this.name = "RemoteNearbyAppointmentsRequestAbortedError";
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

function isValidLocalDateTime(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?$/.exec(value);

  if (!match) {
    return false;
  }

  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4]);

  return (
    isValidDate(match[1]) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59
  );
}

function isNullableLocalDateTime(value: unknown): value is string | null {
  return value === null || isValidLocalDateTime(value);
}

function parseNearbyAppointment(value: unknown): NearbyAppointmentResponse {
  if (
    !isRecord(value) ||
    !isPositiveSafeInteger(value.id) ||
    !isPositiveSafeInteger(value.checklistItemId) ||
    typeof value.title !== "string" ||
    !isValidDate(value.date) ||
    !isNullableLocalDateTime(value.startTime) ||
    !isNullableLocalDateTime(value.endTime) ||
    !isNullableString(value.place) ||
    !isNullableString(value.memo) ||
    value.isDone !== false
  ) {
    throw new RemoteNearbyAppointmentsContractError();
  }

  return {
    checklistItemId: value.checklistItemId,
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

export function parseNearbyAppointments(
  value: unknown,
  maximumLength: number,
): NearbyAppointmentResponse[] {
  if (!Array.isArray(value) || value.length > maximumLength) {
    throw new RemoteNearbyAppointmentsContractError();
  }

  return value.map(parseNearbyAppointment);
}

function toRequestError(
  error: unknown,
  didTimeout: boolean,
  callerSignal?: AbortSignal,
): Error {
  if (didTimeout) {
    return new RemoteNearbyAppointmentsTimeoutError({ cause: error });
  }

  if (callerSignal?.aborted) {
    return new RemoteNearbyAppointmentsRequestAbortedError({ cause: error });
  }

  return new RemoteNearbyAppointmentsNetworkError({ cause: error });
}

async function getNearbyAppointments(
  limit: number,
  signal?: AbortSignal,
): Promise<NearbyAppointmentResponse[]> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, NEARBY_APPOINTMENTS_REQUEST_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await fetch(
        `${NEARBY_APPOINTMENTS_ENDPOINT}?limit=${encodeURIComponent(limit)}`,
        {
          credentials: "include",
          method: "GET",
          signal: controller.signal,
        },
      );
    } catch (error) {
      throw toRequestError(error, didTimeout, signal);
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
        throw new RemoteNearbyAppointmentsApiError(0, response.status);
      }

      throw new RemoteNearbyAppointmentsContractError({ cause: error });
    }

    if (!response.ok) {
      throw new RemoteNearbyAppointmentsApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body)
          ? body.message
          : "가까운 일정을 불러오지 못했습니다.",
      );
    }

    return parseNearbyAppointments(body, limit);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export const remoteNearbyAppointmentsDataSource: RemoteNearbyAppointmentsDataSource =
  {
    getNearbyAppointments,
  };
