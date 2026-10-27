import { remoteRecommendedCatalogItemsDataSource } from "./data-source/remoteRecommendedCatalogItemsDataSource";
import { createRecommendedCatalogItemsRepository } from "./repository/recommendedCatalogItemsRepository";

export const recommendedCatalogItemsRepository =
  createRecommendedCatalogItemsRepository(
    remoteRecommendedCatalogItemsDataSource,
  );
