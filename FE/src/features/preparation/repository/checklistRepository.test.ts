import { describe, expect, it, vi } from "vitest";
import {
  MyChecklistCommandRepository,
  MyChecklistAuthenticationRequiredError,
  MyChecklistQueryRepository,
} from "../../checklist";
import { LocalChecklistStorageError } from "../data-source/localChecklistDataSource";
import { RemoteChecklistApiError } from "../data-source/remoteChecklistDataSource";
import {
  ChecklistPersistenceError,
  createChecklistRepository as createChecklistRepositoryWithDependencies,
  InvalidChecklistCatalogItemIdError,
} from "./checklistRepository";
import {
  PreparationAuthenticationRequiredError,
  PreparationChecklistAdditionError,
  PreparationChecklistNotFoundError,
  PreparationDuplicateChecklistItemError,
} from "./preparationErrors";

function createLocalDataSource(catalogItemIds: number[] = []) {
  return {
    getCatalogItemIds: vi.fn().mockReturnValue(catalogItemIds),
    removeCatalogItemIds: vi.fn(),
    setCatalogItemIds: vi.fn(),
  };
}

function createRemoteDataSource(catalogItemIds: number[] = []) {
  return {
    addCatalogItemIds: vi.fn().mockResolvedValue(catalogItemIds),
  };
}

function createCommandRepository(): MyChecklistCommandRepository {
  return {
    ensureChecklist: vi.fn().mockResolvedValue(undefined),
    reconcileMissingChecklist: vi.fn().mockResolvedValue(undefined),
  };
}

function createQueryRepository(
  catalogItemIds: number[] = [],
  exists = true,
): MyChecklistQueryRepository {
  return {
    getChecklist: vi.fn().mockResolvedValue({
      exists,
      items: catalogItemIds.map((sourceCatalogItemId) => ({
        isDone: false,
        sourceCatalogItemId,
      })),
    }),
    invalidate: vi.fn(),
  };
}

function createChecklistRepository(
  localDataSource: ReturnType<typeof createLocalDataSource>,
  remoteDataSource: ReturnType<typeof createRemoteDataSource>,
  queryRepository = createQueryRepository(),
  commandRepository = createCommandRepository(),
) {
  return createChecklistRepositoryWithDependencies(
    localDataSource,
    remoteDataSource,
    commandRepository,
    queryRepository,
  );
}

describe("ChecklistRepository", () => {
  it("비로그인 사용자는 로컬 숫자 ID를 카탈로그 모델의 문자열 ID로 변환한다", async () => {
    const dataSource = createLocalDataSource([101, 201]);
    const remoteDataSource = createRemoteDataSource();
    const repository = createChecklistRepository(dataSource, remoteDataSource);

    await expect(repository.getCatalogItemIds("guest")).resolves.toEqual([
      "101",
      "201",
    ]);
    expect(dataSource.getCatalogItemIds).toHaveBeenCalledOnce();
  });

  it("비로그인 추가는 신규 ID만 반환하고 기존 ID와 합쳐 저장한다", async () => {
    const dataSource = createLocalDataSource([101, 201]);
    const repository = createChecklistRepository(
      dataSource,
      createRemoteDataSource(),
    );

    await expect(
      repository.addCatalogItemIds("guest", ["102", "201", "102"]),
    ).resolves.toEqual(["102"]);
    expect(dataSource.setCatalogItemIds).toHaveBeenCalledWith([101, 201, 102]);
  });

  it("비로그인 빈 ID 목록은 빈 결과를 반환하고 다시 저장하지 않는다", async () => {
    const dataSource = createLocalDataSource([101]);
    const repository = createChecklistRepository(
      dataSource,
      createRemoteDataSource(),
    );

    await expect(repository.addCatalogItemIds("guest", [])).resolves.toEqual(
      [],
    );
    expect(dataSource.setCatalogItemIds).not.toHaveBeenCalled();
  });

  it("비로그인 추가 ID가 모두 저장되어 있으면 빈 결과를 반환하고 다시 저장하지 않는다", async () => {
    const dataSource = createLocalDataSource([101, 102]);
    const repository = createChecklistRepository(
      dataSource,
      createRemoteDataSource(),
    );

    await expect(
      repository.addCatalogItemIds("guest", ["102", "101", "102"]),
    ).resolves.toEqual([]);
    expect(dataSource.setCatalogItemIds).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.5", "not-a-number"])(
    "양의 정수가 아닌 ID %s 추가를 거부한다",
    async (catalogItemId) => {
      const dataSource = createLocalDataSource();
      const repository = createChecklistRepository(
        dataSource,
        createRemoteDataSource(),
      );

      await expect(
        repository.addCatalogItemIds("guest", [catalogItemId]),
      ).rejects.toThrowError(InvalidChecklistCatalogItemIdError);
      expect(dataSource.getCatalogItemIds).not.toHaveBeenCalled();
      expect(dataSource.setCatalogItemIds).not.toHaveBeenCalled();
    },
  );

  it("로컬 DataSource 저장 오류를 Repository 오류로 변환한다", async () => {
    const dataSource = createLocalDataSource([101]);
    dataSource.setCatalogItemIds.mockImplementation(() => {
      throw new LocalChecklistStorageError("write");
    });
    const repository = createChecklistRepository(
      dataSource,
      createRemoteDataSource(),
    );

    await expect(
      repository.addCatalogItemIds("guest", ["102"]),
    ).rejects.toThrowError(ChecklistPersistenceError);
  });

  it("로그인 추가는 숫자 ID를 서버에 보내고 응답 ID를 문자열로 변환한다", async () => {
    const remoteDataSource = createRemoteDataSource([102, 201]);
    const queryRepository = createQueryRepository();
    const commandRepository = createCommandRepository();
    const repository = createChecklistRepository(
      createLocalDataSource(),
      remoteDataSource,
      queryRepository,
      commandRepository,
    );
    const controller = new AbortController();

    await expect(
      repository.addCatalogItemIds(
        "authenticated",
        ["102", "201"],
        controller.signal,
      ),
    ).resolves.toEqual(["102", "201"]);
    expect(remoteDataSource.addCatalogItemIds).toHaveBeenCalledWith(
      [102, 201],
      controller.signal,
    );
    expect(commandRepository.ensureChecklist).toHaveBeenCalledWith(
      controller.signal,
    );
    expect(queryRepository.invalidate).toHaveBeenCalledOnce();
  });

  it("추가 중 체크리스트 없음 응답을 받으면 공통 생성 계층으로 재조정한 뒤 한 번 다시 추가한다", async () => {
    const remoteDataSource = createRemoteDataSource();
    remoteDataSource.addCatalogItemIds
      .mockRejectedValueOnce(
        new RemoteChecklistApiError(303, 404, "체크리스트를 찾을 수 없습니다."),
      )
      .mockResolvedValueOnce([102]);
    const commandRepository = createCommandRepository();
    const repository = createChecklistRepository(
      createLocalDataSource(),
      remoteDataSource,
      createQueryRepository(),
      commandRepository,
    );

    await expect(
      repository.addCatalogItemIds("authenticated", ["102"]),
    ).resolves.toEqual(["102"]);
    expect(commandRepository.ensureChecklist).toHaveBeenCalledOnce();
    expect(commandRepository.reconcileMissingChecklist).toHaveBeenCalledOnce();
    expect(remoteDataSource.addCatalogItemIds).toHaveBeenCalledTimes(2);
  });

  it("공통 생성 계층의 인증 오류를 준비 목록 인증 오류로 변환한다", async () => {
    const remoteDataSource = createRemoteDataSource();
    const commandRepository = createCommandRepository();
    vi.mocked(commandRepository.ensureChecklist).mockRejectedValue(
      new MyChecklistAuthenticationRequiredError(),
    );
    const repository = createChecklistRepository(
      createLocalDataSource(),
      remoteDataSource,
      createQueryRepository(),
      commandRepository,
    );

    await expect(
      repository.addCatalogItemIds("authenticated", ["102"]),
    ).rejects.toBeInstanceOf(PreparationAuthenticationRequiredError);
    expect(remoteDataSource.addCatalogItemIds).not.toHaveBeenCalled();
  });

  it("공통 생성 계층의 일반 오류를 준비 항목 추가 오류로 변환한다", async () => {
    const remoteDataSource = createRemoteDataSource();
    const commandRepository = createCommandRepository();
    vi.mocked(commandRepository.ensureChecklist).mockRejectedValue(
      new Error("creation failed"),
    );
    const repository = createChecklistRepository(
      createLocalDataSource(),
      remoteDataSource,
      createQueryRepository(),
      commandRepository,
    );

    await expect(
      repository.addCatalogItemIds("authenticated", ["102"]),
    ).rejects.toBeInstanceOf(PreparationChecklistAdditionError);
    expect(remoteDataSource.addCatalogItemIds).not.toHaveBeenCalled();
  });

  it.each([
    new RemoteChecklistApiError(0, 401, "로그인이 필요합니다."),
    new RemoteChecklistApiError(201, 500, "로그인이 필요합니다."),
  ])(
    "추가 요청의 401 또는 errorCode 201을 로그인 만료로 변환한다",
    async (apiError) => {
      const remoteDataSource = createRemoteDataSource();
      remoteDataSource.addCatalogItemIds.mockRejectedValue(apiError);
      const repository = createChecklistRepository(
        createLocalDataSource(),
        remoteDataSource,
      );

      await expect(
        repository.addCatalogItemIds("authenticated", ["102"]),
      ).rejects.toBeInstanceOf(PreparationAuthenticationRequiredError);
    },
  );

  it("추가 요청의 404 / errorCode 303을 체크리스트 없음으로 변환한다", async () => {
    const remoteDataSource = createRemoteDataSource();
    remoteDataSource.addCatalogItemIds.mockRejectedValue(
      new RemoteChecklistApiError(303, 404, "체크리스트를 찾을 수 없습니다."),
    );
    const repository = createChecklistRepository(
      createLocalDataSource(),
      remoteDataSource,
    );

    await expect(
      repository.addCatalogItemIds("authenticated", ["102"]),
    ).rejects.toBeInstanceOf(PreparationChecklistNotFoundError);
  });

  it("추가 요청의 409 / errorCode 403을 중복 항목 오류로 변환한다", async () => {
    const remoteDataSource = createRemoteDataSource();
    remoteDataSource.addCatalogItemIds.mockRejectedValue(
      new RemoteChecklistApiError(403, 409, "이미 추가된 준비 항목입니다."),
    );
    const repository = createChecklistRepository(
      createLocalDataSource(),
      remoteDataSource,
    );

    await expect(
      repository.addCatalogItemIds("authenticated", ["102"]),
    ).rejects.toBeInstanceOf(PreparationDuplicateChecklistItemError);
  });

  it("그 밖의 추가 실패를 재시도 가능한 추가 오류로 변환한다", async () => {
    const remoteDataSource = createRemoteDataSource();
    remoteDataSource.addCatalogItemIds.mockRejectedValue(
      new Error("network failed"),
    );
    const repository = createChecklistRepository(
      createLocalDataSource(),
      remoteDataSource,
    );

    await expect(
      repository.addCatalogItemIds("authenticated", ["102"]),
    ).rejects.toBeInstanceOf(PreparationChecklistAdditionError);
  });

  it("서버 체크리스트의 숫자 ID를 카탈로그 모델의 문자열 ID로 변환한다", async () => {
    const queryRepository = createQueryRepository([101, 201]);
    const repository = createChecklistRepository(
      createLocalDataSource(),
      createRemoteDataSource(),
      queryRepository,
    );

    await expect(
      repository.getCatalogItemIds("authenticated"),
    ).resolves.toEqual(["101", "201"]);
    expect(queryRepository.getChecklist).toHaveBeenCalledOnce();
  });

  it.each([true, false])(
    "빈 체크리스트와 체크리스트 없음 모두 포함된 준비 항목이 없는 것으로 처리한다",
    async (exists) => {
      const queryRepository = createQueryRepository([], exists);
      const repository = createChecklistRepository(
        createLocalDataSource(),
        createRemoteDataSource(),
        queryRepository,
      );

      await expect(
        repository.getCatalogItemIds("authenticated"),
      ).resolves.toEqual([]);
    },
  );

  it("내 체크리스트의 인증 오류를 로그인 만료 오류로 변환한다", async () => {
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist).mockRejectedValue(
      new MyChecklistAuthenticationRequiredError(),
    );
    const repository = createChecklistRepository(
      createLocalDataSource(),
      createRemoteDataSource(),
      queryRepository,
    );

    await expect(
      repository.getCatalogItemIds("authenticated"),
    ).rejects.toBeInstanceOf(PreparationAuthenticationRequiredError);
  });
});
