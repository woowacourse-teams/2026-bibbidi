import { describe, expect, it, vi } from "vitest";

import {
  RemoteNearbyAppointmentsApiError,
  RemoteNearbyAppointmentsContractError,
  RemoteNearbyAppointmentsDataSource,
  NearbyAppointmentResponse,
  RemoteNearbyAppointmentsNetworkError,
  RemoteNearbyAppointmentsRequestAbortedError,
  RemoteNearbyAppointmentsTimeoutError,
} from "../data-source/remoteNearbyAppointmentsDataSource";
import {
  createNearbyAppointmentsRepository,
  NearbyAppointmentsApiError,
  NearbyAppointmentsAuthenticationRequiredError,
  NearbyAppointmentsContractError,
  NearbyAppointmentsNetworkError,
  NearbyAppointmentsRequestAbortedError,
  NearbyAppointmentsTimeoutError,
} from "./nearbyAppointmentsRepository";

function createAppointment(
  patch: Partial<NearbyAppointmentResponse> = {},
): NearbyAppointmentResponse {
  return {
    checklistItemId: 10,
    date: "2026-09-20",
    endTime: "2026-09-20T15:00:00",
    id: 1,
    isDone: false,
    memo: null,
    place: "비비디 웨딩홀",
    startTime: "2026-09-20T14:05:00",
    title: "웨딩홀 상담",
    ...patch,
  };
}

function createDataSource(
  result: NearbyAppointmentResponse[] = [],
): RemoteNearbyAppointmentsDataSource {
  return {
    getNearbyAppointments: vi.fn().mockResolvedValue(result),
  };
}

describe("createNearbyAppointmentsRepository", () => {
  it("limit 6을 전달하고 API 순서와 원본 표시 데이터를 보존한다", async () => {
    const dataSource = createDataSource([
      createAppointment({ id: 2, place: "  ", startTime: null }),
      createAppointment({ id: 1, place: null }),
      createAppointment({ id: 3, place: "온라인" }),
    ]);
    const repository = createNearbyAppointmentsRepository(dataSource);
    const controller = new AbortController();

    await expect(
      repository.getNearbyAppointments(controller.signal),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 2,
        place: "  ",
        startTime: null,
      }),
      expect.objectContaining({
        id: 1,
        place: null,
        startTime: "2026-09-20T14:05:00",
      }),
      expect.objectContaining({ id: 3, place: "온라인" }),
    ]);
    expect(dataSource.getNearbyAppointments).toHaveBeenCalledWith(
      6,
      controller.signal,
    );
  });

  it.each([
    [
      "API",
      new RemoteNearbyAppointmentsApiError(901, 500),
      NearbyAppointmentsApiError,
    ],
    [
      "계약",
      new RemoteNearbyAppointmentsContractError(),
      NearbyAppointmentsContractError,
    ],
    [
      "네트워크",
      new RemoteNearbyAppointmentsNetworkError(),
      NearbyAppointmentsNetworkError,
    ],
    [
      "timeout",
      new RemoteNearbyAppointmentsTimeoutError(),
      NearbyAppointmentsTimeoutError,
    ],
    [
      "호출자 취소",
      new RemoteNearbyAppointmentsRequestAbortedError(),
      NearbyAppointmentsRequestAbortedError,
    ],
  ])("%s 오류를 구분해 변환한다", async (_, sourceError, ExpectedError) => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getNearbyAppointments).mockRejectedValue(sourceError);
    const repository = createNearbyAppointmentsRepository(dataSource);

    await expect(repository.getNearbyAppointments()).rejects.toBeInstanceOf(
      ExpectedError,
    );
  });

  it.each([
    new RemoteNearbyAppointmentsApiError(201, 400),
    new RemoteNearbyAppointmentsApiError(202, 400),
    new RemoteNearbyAppointmentsApiError(0, 401),
  ])("현재 인증 오류 계약을 인증 필요 오류로 변환한다", async (sourceError) => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getNearbyAppointments).mockRejectedValue(sourceError);
    const repository = createNearbyAppointmentsRepository(dataSource);

    await expect(repository.getNearbyAppointments()).rejects.toBeInstanceOf(
      NearbyAppointmentsAuthenticationRequiredError,
    );
  });
});
