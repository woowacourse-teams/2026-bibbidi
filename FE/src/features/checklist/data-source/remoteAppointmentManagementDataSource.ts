import {
  AppointmentCreationRequest,
  AppointmentCreationResponse,
  isAppointmentRequest,
  isAppointmentResponse,
} from "./remoteAppointmentCreationDataSource";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 10_000;

export interface AppointmentCompletionResponse {
  checklistItemDone: boolean;
  checklistItemId: number;
  id: number;
  isDone: boolean;
}

export interface RemoteAppointmentManagementDataSource {
  changeAppointmentCompletion(
    appointmentId: number,
    isDone: boolean,
    signal?: AbortSignal,
  ): Promise<AppointmentCompletionResponse>;
  deleteAppointment(appointmentId: number, signal?: AbortSignal): Promise<void>;
  updateAppointment(
    appointmentId: number,
    checklistItemId: number,
    request: AppointmentCreationRequest,
    signal?: AbortSignal,
  ): Promise<AppointmentCreationResponse>;
}

type AppointmentManagementOperation = "completion" | "delete" | "update";

export class RemoteAppointmentManagementApiError extends Error {
  constructor(
    readonly operation: AppointmentManagementOperation,
    readonly status: number,
    readonly errorCode: number,
    message = "일정을 변경하지 못했습니다.",
  ) {
    super(message);
    this.name = "RemoteAppointmentManagementApiError";
  }
}

export class RemoteAppointmentManagementContractError extends Error {
  constructor(
    readonly operation: AppointmentManagementOperation,
    readonly stage: "request" | "response",
    options?: ErrorOptions,
  ) {
    super("일정 관리 API 계약이 올바르지 않습니다.", options);
    this.name = "RemoteAppointmentManagementContractError";
  }
}

export class RemoteAppointmentManagementNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정 변경 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteAppointmentManagementNetworkError";
  }
}

export class RemoteAppointmentManagementTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정 변경 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteAppointmentManagementTimeoutError";
  }
}

export class RemoteAppointmentManagementRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정 변경 요청이 취소됐습니다.", options);
    this.name = "RemoteAppointmentManagementRequestAbortedError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isCompletionResponse(
  value: unknown,
  appointmentId: number,
): value is AppointmentCompletionResponse {
  return (
    isRecord(value) &&
    value.id === appointmentId &&
    typeof value.isDone === "boolean" &&
    isId(value.checklistItemId) &&
    typeof value.checklistItemDone === "boolean"
  );
}

function getApiError(body: unknown) {
  return {
    errorCode:
      isRecord(body) && typeof body.errorCode === "number" ? body.errorCode : 0,
    message:
      isRecord(body) && typeof body.message === "string"
        ? body.message
        : undefined,
  };
}

function toRequestError(
  error: unknown,
  timedOut: boolean,
  signal?: AbortSignal,
): Error {
  if (signal?.aborted) {
    return new RemoteAppointmentManagementRequestAbortedError({
      cause: error,
    });
  }
  if (timedOut) {
    return new RemoteAppointmentManagementTimeoutError({ cause: error });
  }
  return new RemoteAppointmentManagementNetworkError({ cause: error });
}

async function request(
  operation: AppointmentManagementOperation,
  appointmentId: unknown,
  pathSuffix: "" | "/complete",
  init: RequestInit,
  consume: (
    response: Response,
    requestState: { timedOut: boolean },
  ) => Promise<unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!isId(appointmentId)) {
    throw new RemoteAppointmentManagementContractError(operation, "request");
  }
  if (signal?.aborted) {
    throw new RemoteAppointmentManagementRequestAbortedError();
  }

  const controller = new AbortController();
  const requestState = { timedOut: false };
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeoutId = window.setTimeout(() => {
    requestState.timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/appointments/${appointmentId}${pathSuffix}`,
        {
          ...init,
          credentials: "include",
          signal: controller.signal,
        },
      );
      return await consume(response, requestState);
    } catch (error) {
      if (
        error instanceof RemoteAppointmentManagementApiError ||
        error instanceof RemoteAppointmentManagementContractError ||
        error instanceof RemoteAppointmentManagementRequestAbortedError ||
        error instanceof RemoteAppointmentManagementTimeoutError
      ) {
        throw error;
      }
      throw toRequestError(error, requestState.timedOut, signal);
    }
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abort);
  }
}

async function readJson(
  response: Response,
  operation: AppointmentManagementOperation,
  requestState: { timedOut: boolean },
  signal?: AbortSignal,
): Promise<unknown> {
  let body: unknown;

  try {
    body = await response.json();
  } catch (error) {
    if (signal?.aborted || requestState.timedOut) {
      throw toRequestError(error, requestState.timedOut, signal);
    }
    if (!response.ok) {
      throw new RemoteAppointmentManagementApiError(
        operation,
        response.status,
        0,
      );
    }
    throw new RemoteAppointmentManagementContractError(operation, "response", {
      cause: error,
    });
  }

  if (signal?.aborted || requestState.timedOut) {
    throw toRequestError(
      new DOMException("aborted", "AbortError"),
      requestState.timedOut,
      signal,
    );
  }
  if (!response.ok) {
    const apiError = getApiError(body);
    throw new RemoteAppointmentManagementApiError(
      operation,
      response.status,
      apiError.errorCode,
      apiError.message,
    );
  }

  return body;
}

async function changeAppointmentCompletion(
  appointmentId: number,
  isDone: boolean,
  signal?: AbortSignal,
): Promise<AppointmentCompletionResponse> {
  if (typeof isDone !== "boolean") {
    throw new RemoteAppointmentManagementContractError("completion", "request");
  }

  return (await request(
    "completion",
    appointmentId,
    "/complete",
    {
      body: JSON.stringify(isDone),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    },
    async (response, requestState) => {
      const body = await readJson(response, "completion", requestState, signal);

      if (
        response.status !== 200 ||
        !isCompletionResponse(body, appointmentId) ||
        body.isDone !== isDone
      ) {
        throw new RemoteAppointmentManagementContractError(
          "completion",
          "response",
        );
      }

      return body;
    },
    signal,
  )) as AppointmentCompletionResponse;
}

async function updateAppointment(
  appointmentId: number,
  checklistItemId: number,
  appointment: AppointmentCreationRequest,
  signal?: AbortSignal,
): Promise<AppointmentCreationResponse> {
  if (!isId(checklistItemId) || !isAppointmentRequest(appointment)) {
    throw new RemoteAppointmentManagementContractError("update", "request");
  }

  return (await request(
    "update",
    appointmentId,
    "",
    {
      body: JSON.stringify(appointment),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    },
    async (response, requestState) => {
      const body = await readJson(response, "update", requestState, signal);

      if (
        response.status !== 200 ||
        !isAppointmentResponse(body, checklistItemId) ||
        body.id !== appointmentId
      ) {
        throw new RemoteAppointmentManagementContractError(
          "update",
          "response",
        );
      }

      return body;
    },
    signal,
  )) as AppointmentCreationResponse;
}

async function deleteAppointment(
  appointmentId: number,
  signal?: AbortSignal,
): Promise<void> {
  await request(
    "delete",
    appointmentId,
    "",
    { method: "DELETE" },
    async (response, requestState) => {
      if (signal?.aborted || requestState.timedOut) {
        throw toRequestError(
          new DOMException("aborted", "AbortError"),
          requestState.timedOut,
          signal,
        );
      }
      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch (error) {
          if (signal?.aborted || requestState.timedOut) {
            throw toRequestError(error, requestState.timedOut, signal);
          }
          body = undefined;
        }
        const apiError = getApiError(body);
        throw new RemoteAppointmentManagementApiError(
          "delete",
          response.status,
          apiError.errorCode,
          apiError.message,
        );
      }

      if (response.status !== 204) {
        throw new RemoteAppointmentManagementContractError(
          "delete",
          "response",
        );
      }
    },
    signal,
  );
}

export const remoteAppointmentManagementDataSource: RemoteAppointmentManagementDataSource =
  {
    changeAppointmentCompletion,
    deleteAppointment,
    updateAppointment,
  };
