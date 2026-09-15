import { CatalogModel } from "../model/catalog";

export interface CatalogDataSource {
  getCatalog(signal?: AbortSignal): Promise<CatalogModel>;
}

export interface CatalogRepository {
  getCatalog(signal?: AbortSignal): Promise<CatalogModel>;
}

export function createCatalogRepository(
  dataSource: CatalogDataSource,
): CatalogRepository {
  return {
    getCatalog(signal) {
      return dataSource.getCatalog(signal);
    },
  };
}
