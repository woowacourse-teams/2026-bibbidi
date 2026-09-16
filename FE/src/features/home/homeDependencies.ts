import { remoteNearbyAppointmentsDataSource } from "./data-source/remoteNearbyAppointmentsDataSource";
import { createNearbyAppointmentsRepository } from "./repository/nearbyAppointmentsRepository";

export const nearbyAppointmentsRepository = createNearbyAppointmentsRepository(
  remoteNearbyAppointmentsDataSource,
);
