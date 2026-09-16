import {
  RemoteNearbyAppointmentsApiError,
  RemoteNearbyAppointmentsContractError,
  RemoteNearbyAppointmentsDataSource,
  NearbyAppointmentResponse,
  RemoteNearbyAppointmentsNetworkError,
  RemoteNearbyAppointmentsRequestAbortedError,
  RemoteNearbyAppointmentsTimeoutError,
} from "../data-source/remoteNearbyAppointmentsDataSource";
import { UpcomingScheduleModel } from "../model/upcomingSchedule";

export interface NearbyAppointmentsRepository {
  getNearbyAppointments(signal?: AbortSignal): Promise<UpcomingScheduleModel[]>;
}

export class NearbyAppointmentsAuthenticationRequiredError extends Error {
  constructor(options?: ErrorOptions) {
    super("로그인이 필요합니다.", options);
    this.name = "NearbyAppointmentsAuthenticationRequiredError";
  }
}

export class NearbyAppointmentsApiError extends Error {
  constructor(options?: ErrorOptions) {
    super("가까운 일정을 불러오지 못했습니다.", options);
    this.name = "NearbyAppointmentsApiError";
  }
}

export class NearbyAppointmentsContractError extends Error {
  constructor(options?: ErrorOptions) {
    super("가까운 일정 응답을 확인하지 못했습니다.", options);
    this.name = "NearbyAppointmentsContractError";
  }
}

export class NearbyAppointmentsNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("가까운 일정 요청 중 네트워크 오류가 발생했습니다.", options);
    this.name = "NearbyAppointmentsNetworkError";
  }
}

export class NearbyAppointmentsTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("가까운 일정 요청 시간이 초과됐습니다.", options);
    this.name = "NearbyAppointmentsTimeoutError";
  }
}

export class NearbyAppointmentsRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("가까운 일정 요청이 취소됐습니다.", options);
    this.name = "NearbyAppointmentsRequestAbortedError";
  }
}

function toUpcomingSchedule(
  appointment: NearbyAppointmentResponse,
): UpcomingScheduleModel {
  return {
    date: appointment.date,
    id: appointment.id,
    place: appointment.place,
    startTime: appointment.startTime,
    title: appointment.title,
  };
}

export function createNearbyAppointmentsRepository(
  dataSource: RemoteNearbyAppointmentsDataSource,
): NearbyAppointmentsRepository {
  return {
    async getNearbyAppointments(signal) {
      try {
        const appointments = await dataSource.getNearbyAppointments(6, signal);

        return appointments.map(toUpcomingSchedule);
      } catch (error) {
        if (
          error instanceof RemoteNearbyAppointmentsApiError &&
          (error.status === 401 ||
            error.errorCode === 201 ||
            error.errorCode === 202)
        ) {
          throw new NearbyAppointmentsAuthenticationRequiredError({
            cause: error,
          });
        }

        if (error instanceof RemoteNearbyAppointmentsApiError) {
          throw new NearbyAppointmentsApiError({ cause: error });
        }

        if (error instanceof RemoteNearbyAppointmentsContractError) {
          throw new NearbyAppointmentsContractError({ cause: error });
        }

        if (error instanceof RemoteNearbyAppointmentsNetworkError) {
          throw new NearbyAppointmentsNetworkError({ cause: error });
        }

        if (error instanceof RemoteNearbyAppointmentsTimeoutError) {
          throw new NearbyAppointmentsTimeoutError({ cause: error });
        }

        if (error instanceof RemoteNearbyAppointmentsRequestAbortedError) {
          throw new NearbyAppointmentsRequestAbortedError({ cause: error });
        }

        throw new NearbyAppointmentsApiError({ cause: error });
      }
    },
  };
}
