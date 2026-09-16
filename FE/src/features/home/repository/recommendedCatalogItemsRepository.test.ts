import { describe, expect, it, vi } from "vitest";

import {
  RemoteRecommendedCatalogItemsApiError,
  RemoteRecommendedCatalogItemsContractError,
  RemoteRecommendedCatalogItemsDataSource,
  RemoteRecommendedCatalogItemsNetworkError,
  RemoteRecommendedCatalogItemsRequestAbortedError,
  RemoteRecommendedCatalogItemsTimeoutError,
  RecommendedCatalogItemResponse,
} from "../data-source/remoteRecommendedCatalogItemsDataSource";
import {
  createRecommendedCatalogItemsRepository,
  RecommendedCatalogItemsApiError,
  RecommendedCatalogItemsAuthenticationRequiredError,
  RecommendedCatalogItemsContractError,
  RecommendedCatalogItemsNetworkError,
  RecommendedCatalogItemsRequestAbortedError,
  RecommendedCatalogItemsTimeoutError,
} from "./recommendedCatalogItemsRepository";

function createItem(
  patch: Partial<RecommendedCatalogItemResponse> = {},
): RecommendedCatalogItemResponse {
  return {
    catalogItemId: 201,
    categoryName: "스드메",
    phase: 2,
    stepName: "스드메 업체 확정",
    title: "드레스샵 확정",
    ...patch,
  };
}

function createDataSource(
  result: RecommendedCatalogItemResponse[] = [],
): RemoteRecommendedCatalogItemsDataSource {
  return { getRecommendedCatalogItems: vi.fn().mockResolvedValue(result) };
}

describe("createRecommendedCatalogItemsRepository", () => {
  it("limit 4를 전달하고 API 순서와 표시 데이터만 보존한다", async () => {
    const dataSource = createDataSource([
      createItem({ catalogItemId: 201 }),
      createItem({
        catalogItemId: 100,
        title: "웨딩홀 투어",
        categoryName: "웨딩홀",
        stepName: "웨딩홀 정하기",
        phase: 1,
      }),
    ]);
    const repository = createRecommendedCatalogItemsRepository(dataSource);
    const controller = new AbortController();

    await expect(
      repository.getRecommendedCatalogItems(controller.signal),
    ).resolves.toEqual([
      {
        category: "스드메",
        catalogItemId: 201,
        stepName: "스드메 업체 확정",
        title: "드레스샵 확정",
      },
      {
        category: "웨딩홀",
        catalogItemId: 100,
        stepName: "웨딩홀 정하기",
        title: "웨딩홀 투어",
      },
    ]);
    expect(dataSource.getRecommendedCatalogItems).toHaveBeenCalledWith(
      4,
      controller.signal,
    );
  });

  it("빈 배열을 그대로 반환한다", async () => {
    await expect(
      createRecommendedCatalogItemsRepository(
        createDataSource(),
      ).getRecommendedCatalogItems(),
    ).resolves.toEqual([]);
  });

  it.each([
    [
      "API",
      new RemoteRecommendedCatalogItemsApiError(303, 404),
      RecommendedCatalogItemsApiError,
    ],
    [
      "계약",
      new RemoteRecommendedCatalogItemsContractError(),
      RecommendedCatalogItemsContractError,
    ],
    [
      "네트워크",
      new RemoteRecommendedCatalogItemsNetworkError(),
      RecommendedCatalogItemsNetworkError,
    ],
    [
      "timeout",
      new RemoteRecommendedCatalogItemsTimeoutError(),
      RecommendedCatalogItemsTimeoutError,
    ],
    [
      "호출자 취소",
      new RemoteRecommendedCatalogItemsRequestAbortedError(),
      RecommendedCatalogItemsRequestAbortedError,
    ],
  ])("%s 오류를 구분해 변환한다", async (_, sourceError, ExpectedError) => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getRecommendedCatalogItems).mockRejectedValue(
      sourceError,
    );
    await expect(
      createRecommendedCatalogItemsRepository(
        dataSource,
      ).getRecommendedCatalogItems(),
    ).rejects.toBeInstanceOf(ExpectedError);
  });

  it.each([
    new RemoteRecommendedCatalogItemsApiError(201, 400),
    new RemoteRecommendedCatalogItemsApiError(202, 400),
    new RemoteRecommendedCatalogItemsApiError(0, 401),
  ])("인증 오류를 인증 필요 오류로 변환한다", async (sourceError) => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getRecommendedCatalogItems).mockRejectedValue(
      sourceError,
    );
    await expect(
      createRecommendedCatalogItemsRepository(
        dataSource,
      ).getRecommendedCatalogItems(),
    ).rejects.toBeInstanceOf(
      RecommendedCatalogItemsAuthenticationRequiredError,
    );
  });
});
