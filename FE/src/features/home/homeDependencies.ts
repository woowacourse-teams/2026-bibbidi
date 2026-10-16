import { remoteRecommendedCatalogItemsDataSource } from "./data-source/remoteRecommendedCatalogItemsDataSource";
import { remoteUnscheduledTasksDataSource } from "./data-source/remoteUnscheduledTasksDataSource";
import { createRecommendedCatalogItemsRepository } from "./repository/recommendedCatalogItemsRepository";
import { createUnscheduledTasksRepository } from "./repository/unscheduledTasksRepository";

export const recommendedCatalogItemsRepository =
  createRecommendedCatalogItemsRepository(
    remoteRecommendedCatalogItemsDataSource,
  );

export const unscheduledTasksRepository = createUnscheduledTasksRepository(
  remoteUnscheduledTasksDataSource,
);
