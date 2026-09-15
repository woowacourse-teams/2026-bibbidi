import { describe, expect, it, vi } from "vitest";
import { preparationCatalogFixture } from "../test/fixtures/preparationCatalog.fixture";
import { createPreparationCatalogRepository } from "./preparationCatalogRepository";

describe("PreparationCatalogRepository", () => {
  it("단일 준비 목록 DataSource를 사용한다", async () => {
    const dataSource = {
      getCatalog: vi.fn().mockResolvedValue(preparationCatalogFixture),
    };
    const repository = createPreparationCatalogRepository(dataSource);

    await expect(repository.getCatalog()).resolves.toEqual({
      ...preparationCatalogFixture,
      stepDetails: preparationCatalogFixture.stepDetails.map((stepDetail) => ({
        ...stepDetail,
        tasks: stepDetail.tasks.map((task) => ({
          ...task,
          included: false,
        })),
      })),
    });
    expect(dataSource.getCatalog).toHaveBeenCalledOnce();
  });

  it("DataSource 오류를 그대로 전달한다", async () => {
    const error = new Error("failed");
    const dataSource = {
      getCatalog: vi.fn().mockRejectedValue(error),
    };
    const repository = createPreparationCatalogRepository(dataSource);

    await expect(repository.getCatalog()).rejects.toBe(error);
  });
});
