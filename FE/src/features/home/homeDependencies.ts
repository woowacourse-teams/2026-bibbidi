import { remoteNearbyAppointmentsDataSource } from "./data-source/remoteNearbyAppointmentsDataSource";
import { remoteRecommendedCatalogItemsDataSource } from "./data-source/remoteRecommendedCatalogItemsDataSource";
import { remoteUnscheduledTasksDataSource } from "./data-source/remoteUnscheduledTasksDataSource";
import { createNearbyAppointmentsRepository } from "./repository/nearbyAppointmentsRepository";
import { createRecommendedCatalogItemsRepository } from "./repository/recommendedCatalogItemsRepository";
import { createUnscheduledTasksRepository } from "./repository/unscheduledTasksRepository";

export const nearbyAppointmentsRepository = createNearbyAppointmentsRepository(
  remoteNearbyAppointmentsDataSource,
);

export const recommendedCatalogItemsRepository =
  createRecommendedCatalogItemsRepository(
    remoteRecommendedCatalogItemsDataSource,
  );

export const unscheduledTasksRepository = createUnscheduledTasksRepository(
  remoteUnscheduledTasksDataSource,
);
