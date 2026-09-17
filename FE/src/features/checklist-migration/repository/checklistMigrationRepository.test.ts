import { describe, expect, it, vi } from "vitest";

import {
  AddedChecklistCatalogItemModel,
  MyChecklistAuthenticationRequiredError,
  MyChecklistCommandRepository,
  MyChecklistModel,
  MyChecklistQueryRepository,
} from "../../checklist";
import {
  LocalChecklistDataSource,
  LocalChecklistStorageError,
} from "../../preparation/data-source/localChecklistDataSource";
import {
  RemoteChecklistApiError,
  RemoteChecklistDataSource,
} from "../../preparation/data-source/remoteChecklistDataSource";
import {
  ChecklistMigrationAuthenticationRequiredError,
  ChecklistMigrationRequestAbortedError,
  createChecklistMigrationRepository,
} from "./checklistMigrationRepository";

function createChecklist(
  catalogItemIds: Array<number | null>,
  exists = true,
): MyChecklistModel {
  return {
    exists,
    items: catalogItemIds.map((sourceCatalogItemId, index) => ({
      appointments: [],
      categoryId: 1,
      id: index + 1,
      sourceCatalogItemId,
      status: "prev",
      title: `체크리스트 항목 ${index + 1}`,
    })),
  };
}

function createLocalDataSource(initialCatalogItemIds: number[] = []) {
  let catalogItemIds = [...initialCatalogItemIds];
  const dataSource: LocalChecklistDataSource = {
    getCatalogItemIds: vi.fn(() => [...catalogItemIds]),
    removeCatalogItemIds: vi.fn((resolvedCatalogItemIds: number[]) => {
      const resolvedCatalogItemIdSet = new Set(resolvedCatalogItemIds);
      catalogItemIds = catalogItemIds.filter(
        (catalogItemId) => !resolvedCatalogItemIdSet.has(catalogItemId),
      );
    }),
    setCatalogItemIds: vi.fn((nextCatalogItemIds: number[]) => {
      catalogItemIds = [...nextCatalogItemIds];
    }),
  };

  return {
    dataSource,
    getCatalogItemIds: () => catalogItemIds,
  };
}

function createRemoteDataSource(): RemoteChecklistDataSource {
  return {
    addCatalogItemIds: vi.fn().mockResolvedValue([]),
  };
}

function createAddedItems(
  catalogItemIds: number[],
): AddedChecklistCatalogItemModel[] {
  return catalogItemIds.map((catalogItemId) => ({
    catalogItemId,
    categoryId: 1,
    id: catalogItemId,
    status: "prev",
    title: `추가 항목 ${catalogItemId}`,
  }));
}

function createCommandRepository(): MyChecklistCommandRepository {
  return {
    changeAppointmentCompletion: vi.fn(),
    changeItemCategory: vi.fn().mockResolvedValue(undefined),
    changeItemStatus: vi.fn().mockResolvedValue(undefined),
    changeItemTitle: vi.fn().mockResolvedValue(undefined),
    createCustomItem: vi.fn().mockResolvedValue(undefined),
    ensureChecklist: vi.fn().mockResolvedValue(undefined),
    hasRemainingAppointments: vi.fn().mockResolvedValue(false),
    createAppointment: vi.fn(),
    deleteAppointment: vi.fn(),
    reconcileMissingChecklist: vi.fn().mockResolvedValue(undefined),
    updateAppointment: vi.fn(),
  };
}

function createQueryRepository(): MyChecklistQueryRepository {
  return {
    applyAddedItems: vi.fn(),
    applyAppointmentCompletionUpdate: vi.fn(),
    applyAppointmentRemoval: vi.fn(),
    applyAppointmentUpdate: vi.fn(),
    applyItemCategoryUpdate: vi.fn(),
    applyItemTitleUpdate: vi.fn(),
    getChecklist: vi.fn().mockResolvedValue(createChecklist([])),
    getRevision: vi.fn().mockReturnValue(0),
    invalidate: vi.fn(),
    refresh: vi.fn().mockResolvedValue(createChecklist([])),
    subscribe: vi.fn().mockReturnValue(() => undefined),
  };
}

function createRepository(
  localDataSource: LocalChecklistDataSource,
  remoteDataSource = createRemoteDataSource(),
  commandRepository = createCommandRepository(),
  queryRepository = createQueryRepository(),
) {
  return {
    commandRepository,
    queryRepository,
    remoteDataSource,
    repository: createChecklistMigrationRepository(
      localDataSource,
      remoteDataSource,
      commandRepository,
      queryRepository,
    ),
  };
}

describe("ChecklistMigrationRepository", () => {
  it("로컬 ID가 없으면 서버 API를 호출하지 않는다", async () => {
    const local = createLocalDataSource();
    const dependencies = createRepository(local.dataSource);

    await dependencies.repository.migrate();

    expect(dependencies.queryRepository.getChecklist).not.toHaveBeenCalled();
    expect(
      dependencies.commandRepository.ensureChecklist,
    ).not.toHaveBeenCalled();
    expect(
      dependencies.remoteDataSource.addCatalogItemIds,
    ).not.toHaveBeenCalled();
  });

  it("직접 생성 항목을 제외하고 서버에 없는 ID만 기존 순서로 추가한다", async () => {
    const local = createLocalDataSource([101, 102, 103]);
    const remoteDataSource = createRemoteDataSource();
    vi.mocked(remoteDataSource.addCatalogItemIds).mockResolvedValue(
      createAddedItems([102]),
    );
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist)
      .mockResolvedValueOnce(createChecklist([101, null, 103]))
      .mockResolvedValueOnce(createChecklist([101, 102, null, 103]));
    const dependencies = createRepository(
      local.dataSource,
      remoteDataSource,
      createCommandRepository(),
      queryRepository,
    );

    await dependencies.repository.migrate();

    expect(remoteDataSource.addCatalogItemIds).toHaveBeenCalledWith(
      [102],
      expect.any(AbortSignal),
    );
    expect(local.getCatalogItemIds()).toEqual([]);
    expect(queryRepository.applyAddedItems).toHaveBeenCalledOnce();
    expect(queryRepository.getChecklist).toHaveBeenCalledTimes(2);
  });

  it("모든 로컬 ID가 서버에 있으면 추가 요청 없이 정리한다", async () => {
    const local = createLocalDataSource([101, 102]);
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist).mockResolvedValue(
      createChecklist([101, 102]),
    );
    const dependencies = createRepository(
      local.dataSource,
      createRemoteDataSource(),
      createCommandRepository(),
      queryRepository,
    );

    await dependencies.repository.migrate();

    expect(
      dependencies.remoteDataSource.addCatalogItemIds,
    ).not.toHaveBeenCalled();
    expect(local.getCatalogItemIds()).toEqual([]);
  });

  it("체크리스트가 없으면 생성한 뒤 전체 로컬 ID를 추가한다", async () => {
    const local = createLocalDataSource([101, 102]);
    const remoteDataSource = createRemoteDataSource();
    vi.mocked(remoteDataSource.addCatalogItemIds).mockResolvedValue(
      createAddedItems([101, 102]),
    );
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist)
      .mockResolvedValueOnce(createChecklist([], false))
      .mockResolvedValueOnce(createChecklist([]))
      .mockResolvedValueOnce(createChecklist([101, 102]));
    const commandRepository = createCommandRepository();
    const dependencies = createRepository(
      local.dataSource,
      remoteDataSource,
      commandRepository,
      queryRepository,
    );

    await dependencies.repository.migrate();

    expect(commandRepository.ensureChecklist).toHaveBeenCalledOnce();
    expect(remoteDataSource.addCatalogItemIds).toHaveBeenCalledWith(
      [101, 102],
      expect.any(AbortSignal),
    );
    expect(local.getCatalogItemIds()).toEqual([]);
  });

  it("부분 성공 후 서버 차집합을 다시 계산해 누락 ID만 재시도한다", async () => {
    const local = createLocalDataSource([101, 102]);
    const remoteDataSource = createRemoteDataSource();
    vi.mocked(remoteDataSource.addCatalogItemIds)
      .mockResolvedValueOnce(createAddedItems([101]))
      .mockResolvedValueOnce(createAddedItems([102]));
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist)
      .mockResolvedValueOnce(createChecklist([]))
      .mockResolvedValueOnce(createChecklist([101]))
      .mockResolvedValueOnce(createChecklist([101, 102]));
    const dependencies = createRepository(
      local.dataSource,
      remoteDataSource,
      createCommandRepository(),
      queryRepository,
    );

    await dependencies.repository.migrate();

    expect(remoteDataSource.addCatalogItemIds).toHaveBeenNthCalledWith(
      1,
      [101, 102],
      expect.any(AbortSignal),
    );
    expect(remoteDataSource.addCatalogItemIds).toHaveBeenNthCalledWith(
      2,
      [102],
      expect.any(AbortSignal),
    );
    expect(local.getCatalogItemIds()).toEqual([]);
  });

  it("최대 시도 후에도 누락 ID가 남으면 오류로 처리하고 보존한다", async () => {
    const local = createLocalDataSource([101, 102]);
    const remoteDataSource = createRemoteDataSource();
    vi.mocked(remoteDataSource.addCatalogItemIds)
      .mockResolvedValueOnce(createAddedItems([101]))
      .mockResolvedValueOnce([]);
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist)
      .mockResolvedValueOnce(createChecklist([]))
      .mockResolvedValue(createChecklist([101]));
    const dependencies = createRepository(
      local.dataSource,
      remoteDataSource,
      createCommandRepository(),
      queryRepository,
    );

    await expect(dependencies.repository.migrate()).rejects.toThrow(
      "로컬 체크리스트를 서버에 병합하지 못했습니다.",
    );
    expect(remoteDataSource.addCatalogItemIds).toHaveBeenCalledTimes(2);
    expect(local.getCatalogItemIds()).toEqual([102]);
  });

  it("서버 확인 후 로컬 정리만 실패해도 병합 성공을 유지한다", async () => {
    const local = createLocalDataSource([101]);
    vi.mocked(local.dataSource.removeCatalogItemIds).mockImplementation(() => {
      throw new LocalChecklistStorageError("write");
    });
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist).mockResolvedValue(
      createChecklist([101]),
    );
    const dependencies = createRepository(
      local.dataSource,
      createRemoteDataSource(),
      createCommandRepository(),
      queryRepository,
    );

    await expect(dependencies.repository.migrate()).resolves.toBeUndefined();
    expect(local.getCatalogItemIds()).toEqual([101]);
    expect(
      dependencies.remoteDataSource.addCatalogItemIds,
    ).not.toHaveBeenCalled();
  });

  it("로컬 저장소 오류가 아닌 구현 오류는 숨기지 않는다", async () => {
    const local = createLocalDataSource([101]);
    vi.mocked(local.dataSource.removeCatalogItemIds).mockImplementation(() => {
      throw new TypeError("unexpected implementation error");
    });
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist).mockResolvedValue(
      createChecklist([101]),
    );
    const dependencies = createRepository(
      local.dataSource,
      createRemoteDataSource(),
      createCommandRepository(),
      queryRepository,
    );

    await expect(dependencies.repository.migrate()).rejects.toThrow(
      "unexpected implementation error",
    );
  });

  it("중복 충돌 후 서버 차집합을 다시 계산해 누락 ID만 재시도한다", async () => {
    const local = createLocalDataSource([101, 102]);
    const remoteDataSource = createRemoteDataSource();
    vi.mocked(remoteDataSource.addCatalogItemIds)
      .mockRejectedValueOnce(new RemoteChecklistApiError(403, 409))
      .mockResolvedValueOnce(createAddedItems([102]));
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist)
      .mockResolvedValueOnce(createChecklist([]))
      .mockResolvedValueOnce(createChecklist([101]))
      .mockResolvedValueOnce(createChecklist([101, 102]));
    const dependencies = createRepository(
      local.dataSource,
      remoteDataSource,
      createCommandRepository(),
      queryRepository,
    );

    await dependencies.repository.migrate();

    expect(remoteDataSource.addCatalogItemIds).toHaveBeenNthCalledWith(
      1,
      [101, 102],
      expect.any(AbortSignal),
    );
    expect(remoteDataSource.addCatalogItemIds).toHaveBeenNthCalledWith(
      2,
      [102],
      expect.any(AbortSignal),
    );
    expect(local.getCatalogItemIds()).toEqual([]);
  });

  it("체크리스트 없음 충돌 후 공통 생성 계층으로 재조정한다", async () => {
    const local = createLocalDataSource([101]);
    const remoteDataSource = createRemoteDataSource();
    vi.mocked(remoteDataSource.addCatalogItemIds)
      .mockRejectedValueOnce(new RemoteChecklistApiError(303, 404))
      .mockResolvedValueOnce(createAddedItems([101]));
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist)
      .mockResolvedValueOnce(createChecklist([]))
      .mockResolvedValueOnce(createChecklist([]))
      .mockResolvedValueOnce(createChecklist([101]));
    const commandRepository = createCommandRepository();
    const dependencies = createRepository(
      local.dataSource,
      remoteDataSource,
      commandRepository,
      queryRepository,
    );

    await dependencies.repository.migrate();

    expect(commandRepository.reconcileMissingChecklist).toHaveBeenCalledOnce();
    expect(remoteDataSource.addCatalogItemIds).toHaveBeenCalledTimes(2);
    expect(local.getCatalogItemIds()).toEqual([]);
  });

  it("일반 실패 시 미반영 로컬 ID를 보존한다", async () => {
    const local = createLocalDataSource([101]);
    const remoteDataSource = createRemoteDataSource();
    vi.mocked(remoteDataSource.addCatalogItemIds).mockRejectedValue(
      new Error("network failed"),
    );
    const dependencies = createRepository(local.dataSource, remoteDataSource);

    await expect(dependencies.repository.migrate()).rejects.toThrow(
      "로컬 체크리스트를 서버에 병합하지 못했습니다.",
    );
    expect(local.getCatalogItemIds()).toEqual([101]);
  });

  it("인증 오류를 인증 재확인용 오류로 변환한다", async () => {
    const local = createLocalDataSource([101]);
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist).mockRejectedValue(
      new MyChecklistAuthenticationRequiredError(),
    );
    const dependencies = createRepository(
      local.dataSource,
      createRemoteDataSource(),
      createCommandRepository(),
      queryRepository,
    );

    await expect(dependencies.repository.migrate()).rejects.toBeInstanceOf(
      ChecklistMigrationAuthenticationRequiredError,
    );
    expect(local.getCatalogItemIds()).toEqual([101]);
  });

  it("추가 후 최신 조회의 인증 오류도 인증 재확인용 오류로 유지한다", async () => {
    const local = createLocalDataSource([101]);
    const remoteDataSource = createRemoteDataSource();
    vi.mocked(remoteDataSource.addCatalogItemIds).mockResolvedValue(
      createAddedItems([101]),
    );
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist)
      .mockResolvedValueOnce(createChecklist([]))
      .mockRejectedValueOnce(new MyChecklistAuthenticationRequiredError());
    const dependencies = createRepository(
      local.dataSource,
      remoteDataSource,
      createCommandRepository(),
      queryRepository,
    );

    await expect(dependencies.repository.migrate()).rejects.toBeInstanceOf(
      ChecklistMigrationAuthenticationRequiredError,
    );
  });

  it("호출자 취소 시 미반영 ID를 보존한다", async () => {
    const local = createLocalDataSource([101]);
    const remoteDataSource = createRemoteDataSource();
    vi.mocked(remoteDataSource.addCatalogItemIds).mockImplementation(
      (_catalogItemIds, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const dependencies = createRepository(local.dataSource, remoteDataSource);
    const controller = new AbortController();
    const migration = dependencies.repository.migrate(controller.signal);

    await vi.waitFor(() =>
      expect(remoteDataSource.addCatalogItemIds).toHaveBeenCalledOnce(),
    );
    controller.abort();

    await expect(migration).rejects.toBeInstanceOf(
      ChecklistMigrationRequestAbortedError,
    );
    expect(local.getCatalogItemIds()).toEqual([101]);
  });
});
