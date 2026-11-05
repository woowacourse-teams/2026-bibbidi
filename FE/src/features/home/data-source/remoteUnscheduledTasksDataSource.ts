import { authenticatedFetch } from "../../../infrastructure/http/authenticatedFetch";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const UNSCHEDULED_TASKS_ENDPOINT = `${apiBaseUrl}/api/checklists/me/unscheduled-items`;
const UNSCHEDULED_TASKS_REQUEST_TIMEOUT_MS = 10_000;

interface ApiErrorResponse {
  errorCode: number;
  message: string;
}

export type UnscheduledTaskResponseStatus = "continue" | "prev";

export interface UnscheduledTaskResponse {
  categoryName: string;
  checklistItemId: number;
  status: UnscheduledTaskResponseStatus;
  title: string;
}

export interface RemoteUnscheduledTasksDataSource {
  getUnscheduledTasks(
    limit: number,
    signal?: AbortSignal,
  ): Promise<UnscheduledTaskResponse[]>;
}

export class RemoteUnscheduledTasksApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly status: number,
    message = "일정이 필요한 할 일을 불러오지 못했습니다.",
  ) {
    super(message);
    this.name = "RemoteUnscheduledTasksApiError";
  }
}

export class RemoteUnscheduledTasksContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정이 필요한 할 일 성공 응답 형식이 올바르지 않습니다.", options);
    this.name = "RemoteUnscheduledTasksContractError";
  }
}

export class RemoteUnscheduledTasksNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정이 필요한 할 일 요청 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RemoteUnscheduledTasksNetworkError";
  }
}

export class RemoteUnscheduledTasksTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정이 필요한 할 일 요청 시간이 초과됐습니다.", options);
    this.name = "RemoteUnscheduledTasksTimeoutError";
  }
}

export class RemoteUnscheduledTasksRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정이 필요한 할 일 요청이 취소됐습니다.", options);
    this.name = "RemoteUnscheduledTasksRequestAbortedError";
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

function isUnscheduledTaskResponseStatus(
  value: unknown,
): value is UnscheduledTaskResponseStatus {
  return value === "continue" || value === "prev";
}

function parseUnscheduledTask(value: unknown): UnscheduledTaskResponse {
  if (
    !isRecord(value) ||
    !isPositiveSafeInteger(value.checklistItemId) ||
    typeof value.title !== "string" ||
    typeof value.categoryName !== "string" ||
    !isUnscheduledTaskResponseStatus(value.status)
  ) {
    throw new RemoteUnscheduledTasksContractError();
  }

  return {
    categoryName: value.categoryName,
    checklistItemId: value.checklistItemId,
    status: value.status,
    title: value.title,
  };
}

export function parseUnscheduledTasks(
  value: unknown,
  maximumLength: number,
): UnscheduledTaskResponse[] {
  if (!Array.isArray(value) || value.length > maximumLength) {
    throw new RemoteUnscheduledTasksContractError();
  }

  return value.map(parseUnscheduledTask);
}

function toRequestError(
  error: unknown,
  didTimeout: boolean,
  callerSignal?: AbortSignal,
): Error {
  if (didTimeout) {
    return new RemoteUnscheduledTasksTimeoutError({ cause: error });
  }

  if (callerSignal?.aborted) {
    return new RemoteUnscheduledTasksRequestAbortedError({ cause: error });
  }

  return new RemoteUnscheduledTasksNetworkError({ cause: error });
}

async function getUnscheduledTasks(
  limit: number,
  signal?: AbortSignal,
): Promise<UnscheduledTaskResponse[]> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleCallerAbort = () => controller.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, UNSCHEDULED_TASKS_REQUEST_TIMEOUT_MS);

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", handleCallerAbort, { once: true });
  }

  try {
    let response: Response;

    try {
      response = await authenticatedFetch(
        `${UNSCHEDULED_TASKS_ENDPOINT}?limit=${encodeURIComponent(limit)}`,
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
        throw new RemoteUnscheduledTasksApiError(0, response.status);
      }

      throw new RemoteUnscheduledTasksContractError({ cause: error });
    }

    if (didTimeout || signal?.aborted) {
      throw toRequestError(undefined, didTimeout, signal);
    }

    if (!response.ok) {
      throw new RemoteUnscheduledTasksApiError(
        isApiErrorResponse(body) ? body.errorCode : 0,
        response.status,
        isApiErrorResponse(body)
          ? body.message
          : "일정이 필요한 할 일을 불러오지 못했습니다.",
      );
    }

    return parseUnscheduledTasks(body, limit);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export const remoteUnscheduledTasksDataSource: RemoteUnscheduledTasksDataSource =
  {
    getUnscheduledTasks,
  };
