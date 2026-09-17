import { CatalogDataSource } from "../../catalog/repository/catalogRepository";
import {
  createPreparationCatalogModel,
  PreparationCatalogModel,
} from "../model/preparationRoadmap";

export type PreparationCatalogDataSource = CatalogDataSource;

export interface PreparationCatalogRepository {
  getCatalog(signal?: AbortSignal): Promise<PreparationCatalogModel>;
}

export function createPreparationCatalogRepository(
  dataSource: PreparationCatalogDataSource,
): PreparationCatalogRepository {
  return {
    async getCatalog(signal) {
      const catalog = await dataSource.getCatalog(signal);

      return createPreparationCatalogModel(catalog);
    },
  };
}
