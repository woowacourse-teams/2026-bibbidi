import { PreparationCatalogModel } from "../model/preparationRoadmap";

export interface PreparationCatalogDataSource {
  getCatalog(signal?: AbortSignal): Promise<PreparationCatalogModel>;
}

export interface PreparationCatalogRepository {
  getCatalog(signal?: AbortSignal): Promise<PreparationCatalogModel>;
}

export function createPreparationCatalogRepository(
  dataSource: PreparationCatalogDataSource,
): PreparationCatalogRepository {
  return {
    getCatalog(signal) {
      return dataSource.getCatalog(signal);
    },
  };
}
