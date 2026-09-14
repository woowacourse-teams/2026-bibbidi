import { describe, expect, it, vi } from "vitest";
import { LocalChecklistStorageError } from "../data-source/localChecklistDataSource";
import { RemoteChecklistApiError } from "../data-source/remoteChecklistDataSource";
import {
  ChecklistPersistenceError,
  createChecklistRepository,
  InvalidChecklistCatalogItemIdError,
} from "./checklistRepository";
import { PreparationAuthenticationRequiredError } from "./preparationErrors";

function createLocalDataSource(catalogItemIds: number[] = []) {
  return {
    getCatalogItemIds: vi.fn().mockReturnValue(catalogItemIds),
    setCatalogItemIds: vi.fn(),
  };
}

function createRemoteDataSource(catalogItemIds: number[] = []) {
  return {
    getCatalogItemIds: vi.fn().mockResolvedValue(catalogItemIds),
  };
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
    expect(remoteDataSource.getCatalogItemIds).not.toHaveBeenCalled();
  });

  it("기존 단계의 ID를 보존하며 새 ID를 중복 없이 합쳐 저장한다", () => {
    const dataSource = createLocalDataSource([101, 201]);
    const repository = createChecklistRepository(
      dataSource,
      createRemoteDataSource(),
    );

    expect(repository.addLocalCatalogItemIds(["102", "201", "102"])).toEqual([
      "101",
      "201",
      "102",
    ]);
    expect(dataSource.setCatalogItemIds).toHaveBeenCalledWith([101, 201, 102]);
  });

  it("빈 ID 목록은 현재 값을 반환하고 다시 저장하지 않는다", () => {
    const dataSource = createLocalDataSource([101]);
    const repository = createChecklistRepository(
      dataSource,
      createRemoteDataSource(),
    );

    expect(repository.addLocalCatalogItemIds([])).toEqual(["101"]);
    expect(dataSource.setCatalogItemIds).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.5", "not-a-number"])(
    "양의 정수가 아닌 ID %s 추가를 거부한다",
    (catalogItemId) => {
      const dataSource = createLocalDataSource();
      const repository = createChecklistRepository(
        dataSource,
        createRemoteDataSource(),
      );

      expect(() =>
        repository.addLocalCatalogItemIds([catalogItemId]),
      ).toThrowError(InvalidChecklistCatalogItemIdError);
      expect(dataSource.getCatalogItemIds).not.toHaveBeenCalled();
      expect(dataSource.setCatalogItemIds).not.toHaveBeenCalled();
    },
  );

  it("DataSource 저장 오류를 Repository 오류로 변환한다", () => {
    const dataSource = createLocalDataSource([101]);
    dataSource.setCatalogItemIds.mockImplementation(() => {
      throw new LocalChecklistStorageError("write");
    });
    const repository = createChecklistRepository(
      dataSource,
      createRemoteDataSource(),
    );

    expect(() => repository.addLocalCatalogItemIds(["102"])).toThrowError(
      ChecklistPersistenceError,
    );
  });

  it("서버 체크리스트의 숫자 ID를 카탈로그 모델의 문자열 ID로 변환한다", async () => {
    const remoteDataSource = createRemoteDataSource([101, 201]);
    const repository = createChecklistRepository(
      createLocalDataSource(),
      remoteDataSource,
    );

    await expect(
      repository.getCatalogItemIds("authenticated"),
    ).resolves.toEqual(["101", "201"]);
    expect(remoteDataSource.getCatalogItemIds).toHaveBeenCalledOnce();
  });

  it("내 체크리스트가 없으면 포함된 준비 항목이 없는 것으로 처리한다", async () => {
    const remoteDataSource = createRemoteDataSource();
    remoteDataSource.getCatalogItemIds.mockRejectedValue(
      new RemoteChecklistApiError(303, 404, "체크리스트를 찾을 수 없습니다."),
    );
    const repository = createChecklistRepository(
      createLocalDataSource(),
      remoteDataSource,
    );

    await expect(
      repository.getCatalogItemIds("authenticated"),
    ).resolves.toEqual([]);
  });

  it("내 체크리스트의 인증 오류를 로그인 만료 오류로 변환한다", async () => {
    const remoteDataSource = createRemoteDataSource();
    remoteDataSource.getCatalogItemIds.mockRejectedValue(
      new RemoteChecklistApiError(201, 401, "로그인이 필요합니다."),
    );
    const repository = createChecklistRepository(
      createLocalDataSource(),
      remoteDataSource,
    );

    await expect(
      repository.getCatalogItemIds("authenticated"),
    ).rejects.toBeInstanceOf(PreparationAuthenticationRequiredError);
  });
});
