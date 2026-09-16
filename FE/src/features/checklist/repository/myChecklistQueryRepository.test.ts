import { describe, expect, it, vi } from "vitest";

import {
  RemoteMyChecklistApiError,
  RemoteMyChecklistDataSource,
  RemoteMyChecklistNetworkError,
  RemoteMyChecklistRequestAbortedError,
} from "../data-source/remoteMyChecklistDataSource";
import { MyChecklistModel } from "../model/myChecklist";
import {
  createMyChecklistQueryRepository,
  MyChecklistAuthenticationRequiredError,
  MyChecklistLoadError,
  MyChecklistRequestAbortedError,
} from "./myChecklistQueryRepository";

const checklist: MyChecklistModel = {
  exists: true,
  items: [
    {
      appointments: [],
      categoryId: 1,
      id: 10,
      sourceCatalogItemId: 101,
      status: "done",
      title: "웨딩홀 계약",
    },
  ],
};

function createDataSource(): RemoteMyChecklistDataSource {
  return { getChecklist: vi.fn() };
}

describe("MyChecklistQueryRepository", () => {
  it("동일한 인증 사용자의 진행 중 요청과 결과를 공유한다", async () => {
    let resolveChecklist: (value: MyChecklistModel) => void = () => undefined;
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockReturnValue(
      new Promise((resolve) => {
        resolveChecklist = resolve;
      }),
    );
    const repository = createMyChecklistQueryRepository(dataSource);
    const headerRequest = repository.getChecklist();
    const preparationRequest = repository.getChecklist();
    const checklistScreenRequest = repository.getChecklist();

    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
    resolveChecklist(checklist);
    await expect(headerRequest).resolves.toBe(checklist);
    await expect(preparationRequest).resolves.toBe(checklist);
    await expect(checklistScreenRequest).resolves.toBe(checklist);
    await expect(repository.getChecklist()).resolves.toBe(checklist);
    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
  });

  it("한 구독자가 취소돼도 다른 구독자가 있으면 공통 요청을 유지한다", async () => {
    let resolveChecklist: (value: MyChecklistModel) => void = () => undefined;
    let dataSourceSignal: AbortSignal | undefined;
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockImplementation((signal) => {
      dataSourceSignal = signal;
      return new Promise((resolve) => {
        resolveChecklist = resolve;
      });
    });
    const repository = createMyChecklistQueryRepository(dataSource);
    const headerController = new AbortController();

    const headerRequest = repository.getChecklist(headerController.signal);
    const preparationRequest = repository.getChecklist();
    const headerExpectation = expect(headerRequest).rejects.toBeInstanceOf(
      MyChecklistRequestAbortedError,
    );
    headerController.abort();

    await headerExpectation;
    expect(dataSourceSignal?.aborted).toBe(false);
    resolveChecklist(checklist);
    await expect(preparationRequest).resolves.toBe(checklist);
  });

  it("모든 구독자가 취소되면 공통 요청을 취소한다", async () => {
    let dataSourceSignal: AbortSignal | undefined;
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockImplementation((signal) => {
      dataSourceSignal = signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new RemoteMyChecklistRequestAbortedError());
        });
      });
    });
    const repository = createMyChecklistQueryRepository(dataSource);
    const controller = new AbortController();

    const request = repository.getChecklist(controller.signal);
    const expectation = expect(request).rejects.toBeInstanceOf(
      MyChecklistRequestAbortedError,
    );
    controller.abort();

    await expectation;
    await Promise.resolve();
    expect(dataSourceSignal?.aborted).toBe(true);
  });

  it("마지막 구독 취소 직후 재구독하면 StrictMode의 기존 요청을 공유한다", async () => {
    let resolveChecklist: (value: MyChecklistModel) => void = () => undefined;
    let dataSourceSignal: AbortSignal | undefined;
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockImplementation((signal) => {
      dataSourceSignal = signal;
      return new Promise((resolve) => {
        resolveChecklist = resolve;
      });
    });
    const repository = createMyChecklistQueryRepository(dataSource);
    const controller = new AbortController();

    const firstRequest = repository.getChecklist(controller.signal);
    const firstExpectation = expect(firstRequest).rejects.toBeInstanceOf(
      MyChecklistRequestAbortedError,
    );
    controller.abort();
    const secondRequest = repository.getChecklist();
    resolveChecklist(checklist);

    await firstExpectation;
    await expect(secondRequest).resolves.toBe(checklist);
    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
    expect(dataSourceSignal?.aborted).toBe(false);
  });

  it("무효화 후에는 같은 사용자도 새로 조회한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockResolvedValue(checklist);
    const repository = createMyChecklistQueryRepository(dataSource);
    await repository.getChecklist();
    repository.invalidate();
    await repository.getChecklist();

    expect(dataSource.getChecklist).toHaveBeenCalledTimes(2);
  });

  it("refresh는 오래된 캐시를 즉시 무효화해 알리고 정규 응답으로 다시 알린다", async () => {
    const refreshedChecklist = {
      ...checklist,
      items: [{ ...checklist.items[0], status: "continue" as const }],
    };
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist)
      .mockResolvedValueOnce(checklist)
      .mockResolvedValueOnce(refreshedChecklist);
    const repository = createMyChecklistQueryRepository(dataSource);
    await repository.getChecklist();
    const listener = vi.fn();
    repository.subscribe(listener);
    const revision = repository.getRevision();

    await expect(repository.refresh()).resolves.toEqual(refreshedChecklist);

    expect(dataSource.getChecklist).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(repository.getRevision()).toBe(revision + 2);
    await expect(repository.getChecklist()).resolves.toEqual(
      refreshedChecklist,
    );
  });

  it("refresh 실패 뒤 오래된 캐시를 재사용하지 않고 다음 조회를 재시도한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist)
      .mockResolvedValueOnce(checklist)
      .mockRejectedValueOnce(new RemoteMyChecklistNetworkError())
      .mockResolvedValueOnce(checklist);
    const repository = createMyChecklistQueryRepository(dataSource);
    await repository.getChecklist();

    await expect(repository.refresh()).rejects.toBeInstanceOf(
      MyChecklistLoadError,
    );
    await expect(repository.getChecklist()).resolves.toEqual(checklist);
    expect(dataSource.getChecklist).toHaveBeenCalledTimes(3);
  });

  it("서버가 추가한 항목만 기존 캐시 뒤에 반영하고 별도 조회 없이 구독자에게 알린다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockResolvedValue(checklist);
    const repository = createMyChecklistQueryRepository(dataSource);
    await repository.getChecklist();
    const listener = vi.fn();
    repository.subscribe(listener);

    repository.applyAddedItems([
      {
        appointments: [],
        categoryId: 2,
        id: 11,
        sourceCatalogItemId: 102,
        status: "prev",
        title: "드레스 계약",
      },
      {
        appointments: [],
        categoryId: 3,
        id: 12,
        sourceCatalogItemId: 103,
        status: "continue",
        title: "스냅 계약",
      },
    ]);

    await expect(repository.getChecklist()).resolves.toEqual({
      exists: true,
      items: [
        checklist.items[0],
        {
          appointments: [],
          categoryId: 2,
          id: 11,
          sourceCatalogItemId: 102,
          status: "prev",
          title: "드레스 계약",
        },
        {
          appointments: [],
          categoryId: 3,
          id: 12,
          sourceCatalogItemId: 103,
          status: "continue",
          title: "스냅 계약",
        },
      ],
    });
    expect(checklist.items[0].status).toBe("done");
    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("제목 부분 갱신은 다른 metadata·항목 순서·공통 GET 캐시를 보존한다", async () => {
    const firstItem = {
      ...checklist.items[0],
      appointments: [
        {
          date: "2026-09-20",
          endTime: null,
          id: 91,
          isDone: false,
          memo: "기존 메모",
          place: "서울",
          startTime: null,
          title: "기존 일정",
        },
      ],
      sourceCatalogItemId: null,
    };
    const secondItem = {
      appointments: [],
      categoryId: 2,
      id: 11,
      sourceCatalogItemId: 102,
      status: "continue" as const,
      title: "다른 항목",
    };
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockResolvedValue({
      exists: true,
      items: [firstItem, secondItem],
    });
    const repository = createMyChecklistQueryRepository(dataSource);
    await repository.getChecklist();
    const listener = vi.fn();
    repository.subscribe(listener);

    expect(repository.applyItemTitleUpdate(10, "새 제목")).toBe(true);

    await expect(repository.getChecklist()).resolves.toEqual({
      exists: true,
      items: [
        {
          ...firstItem,
          title: "새 제목",
        },
        secondItem,
      ],
    });
    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
    expect(repository.getRevision()).toBe(2);
  });

  it("카테고리 부분 갱신은 다른 metadata·항목 순서·공통 GET 캐시를 보존한다", async () => {
    const firstItem = {
      ...checklist.items[0],
      appointments: [
        {
          date: "2026-09-20",
          endTime: null,
          id: 91,
          isDone: false,
          memo: "기존 메모",
          place: "서울",
          startTime: null,
          title: "기존 일정",
        },
      ],
      sourceCatalogItemId: null,
    };
    const secondItem = {
      appointments: [],
      categoryId: 2,
      id: 11,
      sourceCatalogItemId: 102,
      status: "continue" as const,
      title: "다른 항목",
    };
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockResolvedValue({
      exists: true,
      items: [firstItem, secondItem],
    });
    const repository = createMyChecklistQueryRepository(dataSource);
    await repository.getChecklist();
    const listener = vi.fn();
    repository.subscribe(listener);

    expect(repository.applyItemCategoryUpdate(10, 3)).toBe(true);

    await expect(repository.getChecklist()).resolves.toEqual({
      exists: true,
      items: [{ ...firstItem, categoryId: 3 }, secondItem],
    });
    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
    expect(repository.getRevision()).toBe(2);
  });

  it("캐시에 없는 항목 수정은 캐시와 revision을 변경하지 않는다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockResolvedValue(checklist);
    const repository = createMyChecklistQueryRepository(dataSource);
    await repository.getChecklist();
    const listener = vi.fn();
    repository.subscribe(listener);
    const revision = repository.getRevision();

    expect(repository.applyItemTitleUpdate(999, "없는 항목")).toBe(false);
    expect(repository.applyItemCategoryUpdate(999, 3)).toBe(false);

    await expect(repository.getChecklist()).resolves.toBe(checklist);
    expect(repository.getRevision()).toBe(revision);
    expect(listener).not.toHaveBeenCalled();
  });

  it("초기 조회 전에 추가가 성공하면 조회를 유지하고 서버 결과 뒤에 추가 항목을 병합한다", async () => {
    let resolveChecklist: (value: MyChecklistModel) => void = () => undefined;
    let dataSourceSignal: AbortSignal | undefined;
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockImplementation((signal) => {
      dataSourceSignal = signal;

      return new Promise((resolve) => {
        resolveChecklist = resolve;
      });
    });
    const repository = createMyChecklistQueryRepository(dataSource);
    const initialRequest = repository.getChecklist();
    const addedItem = {
      appointments: [],
      categoryId: 2,
      id: 11,
      sourceCatalogItemId: 102,
      status: "prev" as const,
      title: "드레스 계약",
    };

    repository.applyAddedItems([addedItem, { ...addedItem }]);

    expect(dataSourceSignal?.aborted).toBe(false);
    resolveChecklist(checklist);
    const mergedChecklist = {
      exists: true,
      items: [checklist.items[0], addedItem],
    };
    await expect(initialRequest).resolves.toEqual(mergedChecklist);
    await expect(repository.getChecklist()).resolves.toEqual(mergedChecklist);
    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
  });

  it("기존 항목과 성공 응답 안의 중복 ID를 캐시에 한 번만 반영한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockResolvedValue(checklist);
    const repository = createMyChecklistQueryRepository(dataSource);
    await repository.getChecklist();
    const duplicateExistingItem = { ...checklist.items[0], title: "중복 기존" };
    const newItem = {
      appointments: [],
      categoryId: 2,
      id: 11,
      sourceCatalogItemId: 102,
      status: "prev" as const,
      title: "드레스 계약",
    };

    repository.applyAddedItems([
      duplicateExistingItem,
      newItem,
      { ...newItem, title: "중복 신규" },
    ]);

    await expect(repository.getChecklist()).resolves.toEqual({
      exists: true,
      items: [checklist.items[0], newItem],
    });
  });

  it("체크리스트 없음 캐시에 빈 성공 결과를 적용해 존재 상태를 갱신한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockRejectedValue(
      new RemoteMyChecklistApiError(303, 404),
    );
    const repository = createMyChecklistQueryRepository(dataSource);
    await repository.getChecklist();

    repository.applyAddedItems([]);

    await expect(repository.getChecklist()).resolves.toEqual({
      exists: true,
      items: [],
    });
    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
  });

  it("구독 해제 뒤에는 캐시 변경을 전달하지 않는다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockResolvedValue(checklist);
    const repository = createMyChecklistQueryRepository(dataSource);
    await repository.getChecklist();
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);
    unsubscribe();

    repository.applyAddedItems([
      {
        appointments: [],
        categoryId: 2,
        id: 11,
        sourceCatalogItemId: 102,
        status: "prev",
        title: "드레스 계약",
      },
    ]);

    expect(listener).not.toHaveBeenCalled();
  });

  it("체크리스트 없음 응답의 존재 여부를 보존해 캐시한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockRejectedValue(
      new RemoteMyChecklistApiError(303, 404),
    );
    const repository = createMyChecklistQueryRepository(dataSource);
    await expect(repository.getChecklist()).resolves.toEqual({
      exists: false,
      items: [],
    });
    await expect(repository.getChecklist()).resolves.toEqual({
      exists: false,
      items: [],
    });
    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
  });

  it.each([
    new RemoteMyChecklistApiError(0, 401),
    new RemoteMyChecklistApiError(201, 500),
  ])(
    "401 또는 errorCode 201을 공통 인증 만료 오류로 변환한다",
    async (apiError) => {
      const dataSource = createDataSource();
      vi.mocked(dataSource.getChecklist).mockRejectedValue(apiError);
      const repository = createMyChecklistQueryRepository(dataSource);

      await expect(repository.getChecklist()).rejects.toBeInstanceOf(
        MyChecklistAuthenticationRequiredError,
      );
    },
  );

  it("그 외 오류를 공통 조회 실패로 변환한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockRejectedValue(
      new RemoteMyChecklistNetworkError(),
    );
    const repository = createMyChecklistQueryRepository(dataSource);

    await expect(repository.getChecklist()).rejects.toBeInstanceOf(
      MyChecklistLoadError,
    );
  });
});
