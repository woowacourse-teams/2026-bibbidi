import {
  RemoteUnscheduledTasksApiError,
  RemoteUnscheduledTasksContractError,
  RemoteUnscheduledTasksDataSource,
  RemoteUnscheduledTasksNetworkError,
  RemoteUnscheduledTasksRequestAbortedError,
  RemoteUnscheduledTasksTimeoutError,
  UnscheduledTaskResponse,
} from "../data-source/remoteUnscheduledTasksDataSource";
import { UnscheduledTaskModel } from "../model/unscheduledTask";

export interface UnscheduledTasksRepository {
  getUnscheduledTasks(signal?: AbortSignal): Promise<UnscheduledTaskModel[]>;
}

export class UnscheduledTasksAuthenticationRequiredError extends Error {
  constructor(options?: ErrorOptions) {
    super("로그인이 필요합니다.", options);
    this.name = "UnscheduledTasksAuthenticationRequiredError";
  }
}

export class UnscheduledTasksApiError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정이 필요한 할 일을 불러오지 못했습니다.", options);
    this.name = "UnscheduledTasksApiError";
  }
}

export class UnscheduledTasksContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정이 필요한 할 일 응답을 확인하지 못했습니다.", options);
    this.name = "UnscheduledTasksContractError";
  }
}

export class UnscheduledTasksNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정이 필요한 할 일 요청 중 네트워크 오류가 발생했습니다.", options);
    this.name = "UnscheduledTasksNetworkError";
  }
}

export class UnscheduledTasksTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정이 필요한 할 일 요청 시간이 초과됐습니다.", options);
    this.name = "UnscheduledTasksTimeoutError";
  }
}

export class UnscheduledTasksRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("일정이 필요한 할 일 요청이 취소됐습니다.", options);
    this.name = "UnscheduledTasksRequestAbortedError";
  }
}

function toUnscheduledTask(
  task: UnscheduledTaskResponse,
): UnscheduledTaskModel {
  return {
    category: task.categoryName,
    id: task.checklistItemId,
    status: task.status,
    title: task.title,
  };
}

export function createUnscheduledTasksRepository(
  dataSource: RemoteUnscheduledTasksDataSource,
): UnscheduledTasksRepository {
  return {
    async getUnscheduledTasks(signal) {
      try {
        const tasks = await dataSource.getUnscheduledTasks(3, signal);

        return tasks.map(toUnscheduledTask);
      } catch (error) {
        if (
          error instanceof RemoteUnscheduledTasksApiError &&
          (error.status === 401 ||
            error.errorCode === 201 ||
            error.errorCode === 202)
        ) {
          throw new UnscheduledTasksAuthenticationRequiredError({
            cause: error,
          });
        }

        if (error instanceof RemoteUnscheduledTasksApiError) {
          throw new UnscheduledTasksApiError({ cause: error });
        }

        if (error instanceof RemoteUnscheduledTasksContractError) {
          throw new UnscheduledTasksContractError({ cause: error });
        }

        if (error instanceof RemoteUnscheduledTasksNetworkError) {
          throw new UnscheduledTasksNetworkError({ cause: error });
        }

        if (error instanceof RemoteUnscheduledTasksTimeoutError) {
          throw new UnscheduledTasksTimeoutError({ cause: error });
        }

        if (error instanceof RemoteUnscheduledTasksRequestAbortedError) {
          throw new UnscheduledTasksRequestAbortedError({ cause: error });
        }

        throw new UnscheduledTasksApiError({ cause: error });
      }
    },
  };
}
