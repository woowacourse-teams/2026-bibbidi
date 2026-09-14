import { RemotePreparationCatalogApiError } from "../data-source/remotePreparationCatalogDataSource";
import {
  PreparationAudience,
  PreparationCatalogModel,
} from "../model/preparationRoadmap";
import { PreparationAuthenticationRequiredError } from "./preparationErrors";

export interface PreparationCatalogDataSource {
  getAuthenticatedCatalog(
    signal?: AbortSignal,
  ): Promise<PreparationCatalogModel>;
  getPublicCatalog(signal?: AbortSignal): Promise<PreparationCatalogModel>;
}

export interface PreparationCatalogRepository {
  getCatalog(
    audience: PreparationAudience,
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
