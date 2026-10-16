import { describe, expect, it, vi } from "vitest";

import { CatalogModel } from "../../catalog/model/catalog";
import { CatalogRepository } from "../../catalog/repository/catalogRepository";
import {
  RemoteCatalogNetworkError,
  RemoteCatalogRequestAbortedError,
  RemoteCatalogTimeoutError,
} from "../../catalog/data-source/remoteCatalogDataSource";
import {
  LocalChecklistDataSource,
  LocalChecklistStorageError,
} from "../data-source/localChecklistDataSource";
import { MyChecklistItemModel } from "../model/myChecklist";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistLoadError,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "./myChecklistQueryRepository";
import {
  ChecklistQueryAuthenticationRequiredError,
  ChecklistQueryLoadError,
  ChecklistQueryRequestAbortedError,
  createChecklistQueryRepository,
  UnknownChecklistCatalogItemError,
  UnknownChecklistCategoryError,
} from "./checklistQueryRepository";

const catalog: CatalogModel = {
  categories: [
    { id: "20", label: "두 번째 카테고리" },
    { id: "10", label: "첫 번째 카테고리" },
    { id: "30", label: "빈 카테고리" },
  ],
  roadmaps: [
    {
      categoryId: "20",
      steps: [{ id: "200", order: 1, title: "두 번째 단계" }],
    },
    {
      categoryId: "10",
      steps: [
        { id: "100", order: 1, title: "첫 단계" },
        { id: "101", order: 2, title: "다음 단계" },
      ],
    },
    { categoryId: "30", steps: [] },
  ],
  stepDetails: [
    {
      description: "",
      stepId: "200",
      tasks: [{ id: "201", title: "두 번째 항목" }],
    },
    {
      description: "",
      stepId: "100",
      tasks: [
        { id: "101", title: "첫 번째 항목" },
        { id: "102", title: "두 번째 항목" },
      ],
    },
    {
      description: "",
      stepId: "101",
      tasks: [{ id: "103", title: "세 번째 항목" }],
    },
  ],
};

function createCatalogRepository(): CatalogRepository {
  return { getCatalog: vi.fn().mockResolvedValue(catalog) };
}

function createLocalDataSource(
  catalogItemIds: number[] = [],
): LocalChecklistDataSource {
  return {
    getCatalogItemIds: vi.fn().mockReturnValue(catalogItemIds),
    removeCatalogItemIds: vi.fn(),
    setCatalogItemIds: vi.fn(),
  };
}

function createMyChecklistItem(
  id: number,
  categoryId: number,
  sourceCatalogItemId: number | null,
): MyChecklistItemModel {
  return {
    appointments: [
      {
        date: "2026-09-10",
        endTime: null,
        id: id * 10,
        isDone: false,
        memo: null,
        place: null,
        startTime: null,
        title: `일정 ${id}`,
      },
    ],
    categoryId,
    createdAt: `2026-09-23T09:${String(id).padStart(2, "0")}:00`,
    id,
    sourceCatalogItemId,
    status: id % 2 === 0 ? "done" : "prev",
    title: `서버 항목 ${id}`,
  };
}

function createMyChecklistRepository(
  items: MyChecklistItemModel[] = [],
  exists = true,
): MyChecklistQueryRepository {
  return {
    applyAddedItems: vi.fn(),
    applyAppointmentCompletionUpdate: vi.fn(),
    applyAppointmentRemoval: vi.fn(),
    applyAppointmentUpdate: vi.fn(),
    applyItemCategoryUpdate: vi.fn(),
    applyItemTitleUpdate: vi.fn(),
    getChecklist: vi.fn().mockResolvedValue({ exists, items }),
    getRevision: vi.fn().mockReturnValue(0),
    invalidate: vi.fn(),
    refresh: vi.fn().mockResolvedValue({ exists, items }),
    subscribe: vi.fn().mockReturnValue(() => undefined),
  };
}

describe("ChecklistQueryRepository", () => {
  it("비로그인은 로컬 ID와 Catalog를 조합해 Catalog 순서로 항목을 구성한다", async () => {
    const localDataSource = createLocalDataSource([102, 101, 102]);
    const myChecklistRepository = createMyChecklistRepository();
    const repository = createChecklistQueryRepository(
      createCatalogRepository(),
      localDataSource,
      myChecklistRepository,
    );

    const result = await repository.getChecklist("guest");

    expect(result.categories.map((category) => category.id)).toEqual([
      "20",
      "10",
      "30",
    ]);
    expect(result.categories[1]?.steps?.map((step) => step.title)).toEqual([
      "첫 단계",
      "다음 단계",
    ]);
    expect(
      result.categories[1]?.steps?.flatMap((step) =>
        step.items.map((item) => item.sourceCatalogItemId),
      ),
    ).toEqual([101, 102]);
    expect(result.categories[1]?.customItems).toEqual([]);
    expect(myChecklistRepository.getChecklist).not.toHaveBeenCalled();
    expect(localDataSource.setCatalogItemIds).not.toHaveBeenCalled();
    expect(localDataSource.removeCatalogItemIds).not.toHaveBeenCalled();
  });

  it("로그인은 서버 순서와 직접 작성 항목 및 일정 전체 필드를 유지한다", async () => {
    const firstCategoryItem = createMyChecklistItem(10, 10, 101);
    const secondCategoryItem = createMyChecklistItem(20, 20, 201);
    const customItem = createMyChecklistItem(11, 10, null);
    const myChecklistRepository = createMyChecklistRepository([
      firstCategoryItem,
      secondCategoryItem,
      customItem,
    ]);
    const repository = createChecklistQueryRepository(
      createCatalogRepository(),
      createLocalDataSource(),
      myChecklistRepository,
    );

    const result = await repository.getChecklist("authenticated");

    expect(result.categories.map((category) => category.id)).toEqual([
      "20",
      "10",
      "30",
    ]);
    expect(
      result.categories[0]?.items.map((item) => item.checklistItemId),
    ).toEqual([20]);
    expect(
      result.categories[1]?.items.map((item) => item.checklistItemId),
    ).toEqual([10, 11]);
    expect(
      result.categories.flatMap((category) =>
        category.items.map((item) => item.id),
      ),
    ).toEqual(["checklist-item-20", "checklist-item-10", "checklist-item-11"]);
    expect(result.categories[1]?.items[1]).toEqual({
      appointments: customItem.appointments,
      categoryId: "10",
      checklistItemId: 11,
      createdAt: customItem.createdAt,
      id: "checklist-item-11",
      sourceCatalogItemId: null,
      status: "prev",
      title: "서버 항목 11",
    });
  });

  it("직접 작성 항목은 생성 시각과 ID 순서로 정렬한다", async () => {
    const later = createMyChecklistItem(13, 10, null);
    later.createdAt = "2026-09-23T10:00:00";
    const sameTimeLargerId = createMyChecklistItem(12, 10, null);
    sameTimeLargerId.createdAt = "2026-09-23T09:00:00";
    const sameTimeSmallerId = createMyChecklistItem(11, 10, null);
    sameTimeSmallerId.createdAt = "2026-09-23T09:00:00";
    const repository = createChecklistQueryRepository(
      createCatalogRepository(),
      createLocalDataSource(),
      createMyChecklistRepository([later, sameTimeLargerId, sameTimeSmallerId]),
    );

    const result = await repository.getChecklist("authenticated");

    expect(
      result.categories[1]?.customItems?.map((item) => item.checklistItemId),
    ).toEqual([11, 12, 13]);
  });

  it.each([true, false])(
    "빈 체크리스트와 체크리스트 없음은 전체 빈 카테고리로 구성한다",
    async (exists) => {
      const repository = createChecklistQueryRepository(
        createCatalogRepository(),
        createLocalDataSource(),
        createMyChecklistRepository([], exists),
      );

      const result = await repository.getChecklist("authenticated");

      expect(
        result.categories.map(({ id, items, title }) => ({ id, items, title })),
      ).toEqual([
        { id: "20", items: [], title: "두 번째 카테고리" },
        { id: "10", items: [], title: "첫 번째 카테고리" },
        { id: "30", items: [], title: "빈 카테고리" },
      ]);
      expect(result.categories[1]?.steps).toHaveLength(2);
      expect(result.categories[1]?.customItems).toEqual([]);
    },
  );

  it("Catalog에 없는 비로그인 항목 ID를 계약 오류로 처리한다", async () => {
    const repository = createChecklistQueryRepository(
      createCatalogRepository(),
      createLocalDataSource([999]),
      createMyChecklistRepository(),
    );

    await expect(repository.getChecklist("guest")).rejects.toBeInstanceOf(
      UnknownChecklistCatalogItemError,
    );
  });

  it("Catalog에 없는 서버 categoryId를 계약 오류로 처리한다", async () => {
    const repository = createChecklistQueryRepository(
      createCatalogRepository(),
      createLocalDataSource(),
      createMyChecklistRepository([createMyChecklistItem(10, 999, null)]),
    );

    await expect(
      repository.getChecklist("authenticated"),
    ).rejects.toMatchObject({ categoryId: 999 });
    await expect(
      repository.getChecklist("authenticated"),
    ).rejects.toBeInstanceOf(UnknownChecklistCategoryError);
  });

  it.each([
    {
      expectedError: ChecklistQueryAuthenticationRequiredError,
      sourceError: new MyChecklistAuthenticationRequiredError(),
    },
    {
      expectedError: ChecklistQueryLoadError,
      sourceError: new MyChecklistLoadError(),
    },
    {
      expectedError: ChecklistQueryRequestAbortedError,
      sourceError: new MyChecklistRequestAbortedError(),
    },
  ])(
    "공통 MyChecklist 오류를 $expectedError.name으로 변환한다",
    async ({ expectedError, sourceError }) => {
      const myChecklistRepository = createMyChecklistRepository();
      vi.mocked(myChecklistRepository.getChecklist).mockRejectedValue(
        sourceError,
      );
      const repository = createChecklistQueryRepository(
        createCatalogRepository(),
        createLocalDataSource(),
        myChecklistRepository,
      );

      await expect(
        repository.getChecklist("authenticated"),
      ).rejects.toBeInstanceOf(expectedError);
      await expect(
        repository.getChecklist("authenticated"),
      ).rejects.toMatchObject({ cause: sourceError });
    },
  );

  it.each([
    {
      expectedError: ChecklistQueryLoadError,
      sourceError: new RemoteCatalogNetworkError(),
    },
    {
      expectedError: ChecklistQueryLoadError,
      sourceError: new RemoteCatalogTimeoutError(),
    },
    {
      expectedError: ChecklistQueryRequestAbortedError,
      sourceError: new RemoteCatalogRequestAbortedError(),
    },
  ])(
    "Catalog 오류를 $expectedError.name으로 변환한다",
    async ({ expectedError, sourceError }) => {
      const catalogRepository = createCatalogRepository();
      vi.mocked(catalogRepository.getCatalog).mockRejectedValue(sourceError);
      const repository = createChecklistQueryRepository(
        catalogRepository,
        createLocalDataSource(),
        createMyChecklistRepository(),
      );

      await expect(
        repository.getChecklist("authenticated"),
      ).rejects.toBeInstanceOf(expectedError);
      await expect(
        repository.getChecklist("authenticated"),
      ).rejects.toMatchObject({ cause: sourceError });
    },
  );

  it("Local Storage 오류를 조회 오류로 변환한다", async () => {
    const localDataSource = createLocalDataSource();
    const sourceError = new LocalChecklistStorageError("read");
    vi.mocked(localDataSource.getCatalogItemIds).mockImplementation(() => {
      throw sourceError;
    });
    const myChecklistRepository = createMyChecklistRepository();
    const repository = createChecklistQueryRepository(
      createCatalogRepository(),
      localDataSource,
      myChecklistRepository,
    );

    await expect(repository.getChecklist("guest")).rejects.toMatchObject({
      cause: sourceError,
    });
    await expect(repository.getChecklist("guest")).rejects.toBeInstanceOf(
      ChecklistQueryLoadError,
    );
  });
});
