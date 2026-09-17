import {
  RemoteWeddingDateApiError,
  RemoteWeddingDateDataSource,
  RemoteWeddingDateRequestAbortedError,
  remoteWeddingDateDataSource,
} from "../data-source/remoteWeddingDateDataSource";

export interface WeddingDateRepository {
  getWeddingDate(signal?: AbortSignal): Promise<string | null>;
  saveWeddingDate(date: string, signal?: AbortSignal): Promise<string>;
}

export class WeddingDateAuthenticationRequiredError extends Error {
  constructor(options?: ErrorOptions) {
    super("로그인이 필요합니다.", options);
    this.name = "WeddingDateAuthenticationRequiredError";
  }
}

export class WeddingDateRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("결혼 예정일 요청이 취소됐습니다.", options);
    this.name = "WeddingDateRequestAbortedError";
  }
}

export class WeddingDateLoadError extends Error {
  constructor(options?: ErrorOptions) {
    super("결혼 예정일을 불러오지 못했습니다.", options);
    this.name = "WeddingDateLoadError";
  }
}

export class WeddingDateSaveError extends Error {
  constructor(options?: ErrorOptions) {
    super("결혼 예정일을 저장하지 못했습니다.", options);
    this.name = "WeddingDateSaveError";
  }
}

export class WeddingDateInvalidRequestError extends Error {
  constructor(options?: ErrorOptions) {
    super("선택한 날짜를 저장할 수 없습니다.", options);
    this.name = "WeddingDateInvalidRequestError";
  }
}

function translateError(error: unknown, action: "load" | "save"): Error {
  if (error instanceof RemoteWeddingDateRequestAbortedError) {
    return new WeddingDateRequestAbortedError({ cause: error });
  }
  if (error instanceof RemoteWeddingDateApiError && error.status === 401) {
    return new WeddingDateAuthenticationRequiredError({ cause: error });
  }
  if (
    error instanceof RemoteWeddingDateApiError &&
    error.status === 400 &&
    action === "save"
  ) {
    return new WeddingDateInvalidRequestError({ cause: error });
  }
  return action === "load"
    ? new WeddingDateLoadError({ cause: error })
    : new WeddingDateSaveError({ cause: error });
}

export function createWeddingDateRepository(
  dataSource: RemoteWeddingDateDataSource = remoteWeddingDateDataSource,
): WeddingDateRepository {
  return {
    async getWeddingDate(signal) {
      try {
        return await dataSource.getWeddingDate(signal);
      } catch (error) {
        throw translateError(error, "load");
      }
    },
    async saveWeddingDate(date, signal) {
      try {
        return await dataSource.saveWeddingDate(date, signal);
      } catch (error) {
        throw translateError(error, "save");
      }
    },
  };
}
