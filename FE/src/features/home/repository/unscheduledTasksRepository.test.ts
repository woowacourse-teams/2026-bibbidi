import { describe, expect, it, vi } from "vitest";

import {
  RemoteUnscheduledTasksApiError,
  RemoteUnscheduledTasksContractError,
  RemoteUnscheduledTasksDataSource,
  RemoteUnscheduledTasksNetworkError,
  RemoteUnscheduledTasksRequestAbortedError,
  RemoteUnscheduledTasksTimeoutError,
  UnscheduledTaskResponse,
} from "../data-source/remoteUnscheduledTasksDataSource";
import {
  createUnscheduledTasksRepository,
  UnscheduledTasksApiError,
  UnscheduledTasksAuthenticationRequiredError,
  UnscheduledTasksContractError,
  UnscheduledTasksNetworkError,
  UnscheduledTasksRequestAbortedError,
  UnscheduledTasksTimeoutError,
} from "./unscheduledTasksRepository";

function createTask(
  patch: Partial<UnscheduledTaskResponse> = {},
): UnscheduledTaskResponse {
  return {
    categoryName: "웨딩홀",
    checklistItemId: 31,
    status: "prev",
    title: "웨딩홀 투어",
    ...patch,
  };
}

function createDataSource(
  result: UnscheduledTaskResponse[] = [],
): RemoteUnscheduledTasksDataSource {
  return {
    getUnscheduledTasks: vi.fn().mockResolvedValue(result),
  };
}

describe("createUnscheduledTasksRepository", () => {
  it("limit 3을 전달하고 API 순서와 표시 데이터를 보존한다", async () => {
    const dataSource = createDataSource([
      createTask({ checklistItemId: 44, status: "continue" }),
      createTask({ checklistItemId: 31, title: "웨딩홀 투어" }),
      createTask({ checklistItemId: 52, title: "식순 준비" }),
    ]);
    const repository = createUnscheduledTasksRepository(dataSource);
    const controller = new AbortController();

    await expect(
      repository.getUnscheduledTasks(controller.signal),
    ).resolves.toEqual([
      {
        category: "웨딩홀",
        id: 44,
        status: "continue",
        title: "웨딩홀 투어",
      },
      {
        category: "웨딩홀",
        id: 31,
        status: "prev",
        title: "웨딩홀 투어",
      },
      {
        category: "웨딩홀",
        id: 52,
        status: "prev",
        title: "식순 준비",
      },
    ]);
    expect(dataSource.getUnscheduledTasks).toHaveBeenCalledWith(
      3,
      controller.signal,
    );
  });

  it("빈 배열을 그대로 반환한다", async () => {
    const repository = createUnscheduledTasksRepository(createDataSource());

    await expect(repository.getUnscheduledTasks()).resolves.toEqual([]);
  });

  it.each([
    [
      "API",
      new RemoteUnscheduledTasksApiError(303, 404),
      UnscheduledTasksApiError,
    ],
    [
      "계약",
      new RemoteUnscheduledTasksContractError(),
      UnscheduledTasksContractError,
    ],
    [
      "네트워크",
      new RemoteUnscheduledTasksNetworkError(),
      UnscheduledTasksNetworkError,
    ],
    [
      "timeout",
      new RemoteUnscheduledTasksTimeoutError(),
      UnscheduledTasksTimeoutError,
    ],
    [
      "호출자 취소",
      new RemoteUnscheduledTasksRequestAbortedError(),
      UnscheduledTasksRequestAbortedError,
    ],
  ])("%s 오류를 구분해 변환한다", async (_, sourceError, ExpectedError) => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getUnscheduledTasks).mockRejectedValue(sourceError);
    const repository = createUnscheduledTasksRepository(dataSource);

    await expect(repository.getUnscheduledTasks()).rejects.toBeInstanceOf(
      ExpectedError,
    );
  });

  it.each([
    new RemoteUnscheduledTasksApiError(201, 400),
    new RemoteUnscheduledTasksApiError(202, 400),
    new RemoteUnscheduledTasksApiError(0, 401),
  ])("현재 인증 오류 계약을 인증 필요 오류로 변환한다", async (sourceError) => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getUnscheduledTasks).mockRejectedValue(sourceError);
    const repository = createUnscheduledTasksRepository(dataSource);

    await expect(repository.getUnscheduledTasks()).rejects.toBeInstanceOf(
      UnscheduledTasksAuthenticationRequiredError,
    );
  });
});
