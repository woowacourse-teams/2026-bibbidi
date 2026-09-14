import {
  remotePreparationCatalogDataSource,
  RemotePreparationCatalogApiError,
} from "../data-source/remotePreparationCatalogDataSource";
import { PreparationCatalogModel } from "../model/preparationRoadmap";

export type PreparationCatalogAudience = "authenticated" | "guest";

export class PreparationAuthenticationRequiredError extends Error {
  constructor() {
    super("로그인이 필요합니다.");
    this.name = "PreparationAuthenticationRequiredError";
  }
}

export interface PreparationCatalogDataSource {
  getAuthenticatedCatalog(
    signal?: AbortSignal,
  ): Promise<PreparationCatalogModel>;
  getPublicCatalog(signal?: AbortSignal): Promise<PreparationCatalogModel>;
}

export interface PreparationCatalogRepository {
  getCatalog(
    audience: PreparationCatalogAudience,
    signal?: AbortSignal,
  ): Promise<PreparationCatalogModel>;
}

export function createPreparationCatalogRepository(
  dataSource: PreparationCatalogDataSource,
): PreparationCatalogRepository {
  return {
    async getCatalog(audience, signal) {
      try {
        return await (audience === "authenticated"
          ? dataSource.getAuthenticatedCatalog(signal)
          : dataSource.getPublicCatalog(signal));
      } catch (error) {
        if (
          audience === "authenticated" &&
          error instanceof RemotePreparationCatalogApiError &&
          error.status === 401 &&
          error.errorCode === 201
        ) {
          throw new PreparationAuthenticationRequiredError();
        }

        throw error;
      }
    },
  };
}

export const preparationCatalogRepository = createPreparationCatalogRepository(
  remotePreparationCatalogDataSource,
);
