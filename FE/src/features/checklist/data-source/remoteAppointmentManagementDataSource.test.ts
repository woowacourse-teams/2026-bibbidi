import { afterEach, describe, expect, it, vi } from "vitest";

import { AppointmentCreationRequest } from "./remoteAppointmentCreationDataSource";
import {
  remoteAppointmentManagementDataSource,
  RemoteAppointmentManagementApiError,
  RemoteAppointmentManagementContractError,
  RemoteAppointmentManagementRequestAbortedError,
  RemoteAppointmentManagementTimeoutError,
} from "./remoteAppointmentManagementDataSource";

const request: AppointmentCreationRequest = {
  date: "2026-09-20",
  endTime: "2026-09-20T11:00:00",
  memo: "견적 확인",
  place: "웨딩홀",
  startTime: "2026-09-20T10:00:00",
  title: "웨딩홀 상담",
};

const appointmentResponse = {
  ...request,
  checklistItemId: 500,
  conflicts: [],
  id: 11,
  isDone: false,
};

function stubJsonResponse(body: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("remoteAppointmentManagementDataSource", () => {
  it("Boolean 원문으로 완료 상태를 변경하고 응답 계약을 검증한다", async () => {
    const completionResponse = {
      checklistItemDone: false,
      checklistItemId: 500,
      id: 11,
      isDone: true,
    };
    const fetchMock = stubJsonResponse(completionResponse);

    await expect(
      remoteAppointmentManagementDataSource.changeAppointmentCompletion(
        11,
        true,
      ),
    ).resolves.toEqual(completionResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/appointments/11/complete",
      expect.objectContaining({
        body: "true",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
    );
  });

  it("일정 수정은 전체 입력을 PUT하고 같은 일정·항목 응답만 허용한다", async () => {
    const fetchMock = stubJsonResponse({
      ...appointmentResponse,
      title: "수정된 상담",
    });

    await expect(
      remoteAppointmentManagementDataSource.updateAppointment(11, 500, request),
    ).resolves.toMatchObject({ id: 11, checklistItemId: 500 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/appointments/11",
      expect.objectContaining({
        body: JSON.stringify(request),
        credentials: "include",
        method: "PUT",
      }),
    );

    stubJsonResponse({ ...appointmentResponse, id: 12 });
    await expect(
      remoteAppointmentManagementDataSource.updateAppointment(11, 500, request),
    ).rejects.toMatchObject({ operation: "update", stage: "response" });
  });

  it("일정 삭제는 DELETE 204만 성공으로 처리하고 응답 본문을 읽지 않는다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remoteAppointmentManagementDataSource.deleteAppointment(11),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/appointments/11",
      expect.objectContaining({ credentials: "include", method: "DELETE" }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
    await expect(
      remoteAppointmentManagementDataSource.deleteAppointment(11),
    ).rejects.toBeInstanceOf(RemoteAppointmentManagementContractError);
  });

  it("API 오류의 상태·오류 코드를 보존하고 잘못된 성공 응답을 거부한다", async () => {
    stubJsonResponse({ errorCode: 203, message: "권한이 없습니다." }, 403);
    await expect(
      remoteAppointmentManagementDataSource.deleteAppointment(11),
    ).rejects.toEqual(
      new RemoteAppointmentManagementApiError(
        "delete",
        403,
        203,
        "권한이 없습니다.",
      ),
    );

    stubJsonResponse({ id: 11 }, 200);
    await expect(
      remoteAppointmentManagementDataSource.changeAppointmentCompletion(
        11,
        true,
      ),
    ).rejects.toBeInstanceOf(RemoteAppointmentManagementContractError);
  });

  it("10초 timeout과 호출자 취소를 구분한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          (_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) =>
              init.signal?.addEventListener("abort", () =>
                reject(new DOMException("aborted", "AbortError")),
              ),
            ),
        ),
    );
    const timedOut = expect(
      remoteAppointmentManagementDataSource.deleteAppointment(11),
    ).rejects.toBeInstanceOf(RemoteAppointmentManagementTimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);
    await timedOut;

    const controller = new AbortController();
    const aborted = expect(
      remoteAppointmentManagementDataSource.deleteAppointment(
        11,
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(RemoteAppointmentManagementRequestAbortedError);
    controller.abort();
    await aborted;
  });
});
