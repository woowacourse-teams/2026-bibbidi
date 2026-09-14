import { describe, expect, it, vi } from "vitest";
import { RemotePreparationCatalogApiError } from "../data-source/remotePreparationCatalogDataSource";
import { preparationCatalogFixture } from "../test/fixtures/preparationCatalog.fixture";
import { createPreparationCatalogRepository } from "./preparationCatalogRepository";
import { PreparationAuthenticationRequiredError } from "./preparationErrors";

describe("PreparationCatalogRepository", () => {
  it("비로그인 사용자는 공개 준비 목록 DataSource를 사용한다", async () => {
    const dataSource = {
      getAuthenticatedCatalog: vi.fn(),
      getPublicCatalog: vi.fn().mockResolvedValue(preparationCatalogFixture),
    };
    const repository = createPreparationCatalogRepository(dataSource);

    await expect(repository.getCatalog("guest")).resolves.toBe(
      preparationCatalogFixture,
    );
    expect(dataSource.getPublicCatalog).toHaveBeenCalledOnce();
    expect(dataSource.getAuthenticatedCatalog).not.toHaveBeenCalled();
  });

  it("로그인 사용자는 인증 준비 목록 DataSource를 사용한다", async () => {
    const dataSource = {
      getAuthenticatedCatalog: vi
        .fn()
        .mockResolvedValue(preparationCatalogFixture),
      getPublicCatalog: vi.fn(),
    };
    const repository = createPreparationCatalogRepository(dataSource);

    await expect(repository.getCatalog("authenticated")).resolves.toBe(
      preparationCatalogFixture,
    );
    expect(dataSource.getAuthenticatedCatalog).toHaveBeenCalledOnce();
    expect(dataSource.getPublicCatalog).not.toHaveBeenCalled();
  });

  it("인증 준비 목록의 401 응답을 애플리케이션 오류로 변환한다", async () => {
    const dataSource = {
      getAuthenticatedCatalog: vi
        .fn()
        .mockRejectedValue(
          new RemotePreparationCatalogApiError(
            201,
            401,
            "로그인이 필요합니다.",
          ),
        ),
      getPublicCatalog: vi.fn(),
    };
    const repository = createPreparationCatalogRepository(dataSource);

    await expect(repository.getCatalog("authenticated")).rejects.toBeInstanceOf(
      PreparationAuthenticationRequiredError,
    );
  });

  it("공개 준비 목록의 401 응답은 인증 만료 오류로 변환하지 않는다", async () => {
    const error = new RemotePreparationCatalogApiError(
      201,
      401,
      "로그인이 필요합니다.",
    );
    const dataSource = {
      getAuthenticatedCatalog: vi.fn(),
      getPublicCatalog: vi.fn().mockRejectedValue(error),
    };
    const repository = createPreparationCatalogRepository(dataSource);

    await expect(repository.getCatalog("guest")).rejects.toBe(error);
  });

  it("인증 준비 목록의 다른 401 오류는 인증 만료로 변환하지 않는다", async () => {
    const error = new RemotePreparationCatalogApiError(
      202,
      401,
      "인증 정보가 올바르지 않습니다.",
    );
    const dataSource = {
      getAuthenticatedCatalog: vi.fn().mockRejectedValue(error),
      getPublicCatalog: vi.fn(),
    };
    const repository = createPreparationCatalogRepository(dataSource);

    await expect(repository.getCatalog("authenticated")).rejects.toBe(error);
  });
});
