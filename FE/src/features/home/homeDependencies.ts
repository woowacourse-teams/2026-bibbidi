import { remoteNearbyAppointmentsDataSource } from "./data-source/remoteNearbyAppointmentsDataSource";
import { remoteUnscheduledTasksDataSource } from "./data-source/remoteUnscheduledTasksDataSource";
import { createNearbyAppointmentsRepository } from "./repository/nearbyAppointmentsRepository";
import { createUnscheduledTasksRepository } from "./repository/unscheduledTasksRepository";

export const nearbyAppointmentsRepository = createNearbyAppointmentsRepository(
  remoteNearbyAppointmentsDataSource,
);

export const unscheduledTasksRepository = createUnscheduledTasksRepository(
  remoteUnscheduledTasksDataSource,
);
