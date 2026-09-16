import {
  RemoteRecommendedCatalogItemsApiError,
  RemoteRecommendedCatalogItemsContractError,
  RemoteRecommendedCatalogItemsDataSource,
  RemoteRecommendedCatalogItemsNetworkError,
  RemoteRecommendedCatalogItemsRequestAbortedError,
  RemoteRecommendedCatalogItemsTimeoutError,
  RecommendedCatalogItemResponse,
} from "../data-source/remoteRecommendedCatalogItemsDataSource";
import { RecommendedCatalogItemModel } from "../model/recommendedCatalogItem";

export interface RecommendedCatalogItemsRepository {
  getRecommendedCatalogItems(
    signal?: AbortSignal,
  ): Promise<RecommendedCatalogItemModel[]>;
}

export class RecommendedCatalogItemsAuthenticationRequiredError extends Error {
  constructor(options?: ErrorOptions) {
    super("로그인이 필요합니다.", options);
    this.name = "RecommendedCatalogItemsAuthenticationRequiredError";
  }
}

export class RecommendedCatalogItemsApiError extends Error {
  constructor(options?: ErrorOptions) {
    super("추천 할 일을 불러오지 못했습니다.", options);
    this.name = "RecommendedCatalogItemsApiError";
  }
}

export class RecommendedCatalogItemsContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("추천 할 일 응답을 확인하지 못했습니다.", options);
    this.name = "RecommendedCatalogItemsContractError";
  }
}

export class RecommendedCatalogItemsNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("추천 할 일 요청 중 네트워크 오류가 발생했습니다.", options);
    this.name = "RecommendedCatalogItemsNetworkError";
  }
}

export class RecommendedCatalogItemsTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("추천 할 일 요청 시간이 초과됐습니다.", options);
    this.name = "RecommendedCatalogItemsTimeoutError";
  }
}

export class RecommendedCatalogItemsRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("추천 할 일 요청이 취소됐습니다.", options);
    this.name = "RecommendedCatalogItemsRequestAbortedError";
  }
}

function toRecommendedCatalogItem(
  task: RecommendedCatalogItemResponse,
): RecommendedCatalogItemModel {
  return {
    category: task.categoryName,
    catalogItemId: task.catalogItemId,
    stepName: task.stepName,
    title: task.title,
  };
}

export function createRecommendedCatalogItemsRepository(
  dataSource: RemoteRecommendedCatalogItemsDataSource,
): RecommendedCatalogItemsRepository {
  return {
    async getRecommendedCatalogItems(signal) {
      try {
        const tasks = await dataSource.getRecommendedCatalogItems(4, signal);

        return tasks.map(toRecommendedCatalogItem);
      } catch (error) {
        if (
          error instanceof RemoteRecommendedCatalogItemsApiError &&
          (error.status === 401 ||
            error.errorCode === 201 ||
            error.errorCode === 202)
        ) {
          throw new RecommendedCatalogItemsAuthenticationRequiredError({
            cause: error,
          });
        }

        if (error instanceof RemoteRecommendedCatalogItemsApiError) {
          throw new RecommendedCatalogItemsApiError({ cause: error });
        }

        if (error instanceof RemoteRecommendedCatalogItemsContractError) {
          throw new RecommendedCatalogItemsContractError({ cause: error });
        }

        if (error instanceof RemoteRecommendedCatalogItemsNetworkError) {
          throw new RecommendedCatalogItemsNetworkError({ cause: error });
        }

        if (error instanceof RemoteRecommendedCatalogItemsTimeoutError) {
          throw new RecommendedCatalogItemsTimeoutError({ cause: error });
        }

        if (error instanceof RemoteRecommendedCatalogItemsRequestAbortedError) {
          throw new RecommendedCatalogItemsRequestAbortedError({
            cause: error,
          });
        }

        throw new RecommendedCatalogItemsApiError({ cause: error });
      }
    },
  };
}
