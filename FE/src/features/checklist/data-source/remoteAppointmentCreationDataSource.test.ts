import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppointmentCreationRequest,
  createRemoteAppointment,
  RemoteAppointmentCreationApiError,
  RemoteAppointmentCreationContractError,
  RemoteAppointmentCreationNetworkError,
  RemoteAppointmentCreationRequestAbortedError,
  RemoteAppointmentCreationTimeoutError,
} from "./remoteAppointmentCreationDataSource";

const request: AppointmentCreationRequest = {
  title: "웨딩홀 상담",
  date: "2026-09-20",
  startTime: "2026-09-20T10:00:00",
  endTime: "2026-09-20T11:00:00",
  place: "웨딩홀",
  memo: "견적 확인",
};

const response = {
  ...request,
  id: 11,
  checklistItemId: 500,
  isDone: false,
  conflicts: [],
};

function stubResponse(body: unknown, status = 201) {
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

describe("createRemoteAppointment", () => {
  it("올바른 경로, 쿠키와 JSON 본문으로 생성하고 201 응답을 반환한다", async () => {
    const fetchMock = stubResponse(response);
    await expect(createRemoteAppointment(500, request)).resolves.toEqual(
      response,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checklist-items/500/appointments",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("nullable 필드와 충돌 목록이 있는 성공 응답을 검증한다", async () => {
    const nullable = {
      ...response,
      startTime: null,
      endTime: null,
      place: null,
      memo: null,
    };
    const conflict = {
      appointmentId: 9,
      checklistItemId: 501,
      title: "다른 상담",
      date: "2026-09-20",
      startTime: "2026-09-20T10:30:00",
      endTime: "2026-09-20T11:30:00",
      place: null,
    };
    stubResponse({ ...nullable, conflicts: [conflict] });
    await expect(
      createRemoteAppointment(500, {
        ...request,
        startTime: null,
        endTime: null,
        place: null,
        memo: null,
      }),
    ).resolves.toEqual({ ...nullable, conflicts: [conflict] });
  });

  it.each([
    ["잘못된 ID", 0, request],
    ["빈 제목", 500, { ...request, title: "   " }],
    ["너무 긴 제목", 500, { ...request, title: "a".repeat(256) }],
    ["존재하지 않는 날짜", 500, { ...request, date: "2026-02-29" }],
    ["잘못된 시간", 500, { ...request, startTime: "2026-09-20T25:00:00" }],
    ["뒤집힌 시간", 500, { ...request, startTime: "2026-09-20T12:00:00" }],
    ["잘못된 장소", 500, { ...request, place: 12 }],
    ["누락된 nullable 필드", 500, { title: "상담", date: "2026-09-20" }],
  ])("%s 요청 계약 오류는 전송 전에 거부한다", async (_, id, body) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createRemoteAppointment(id, body)).rejects.toMatchObject({
      stage: "request",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["ID", { id: 0 }],
    ["다른 항목", { checklistItemId: 501 }],
    ["날짜", { date: "2026-02-29" }],
    ["시간", { startTime: "2026-09-20T24:00:00" }],
    ["시간 순서", { startTime: "2026-09-20T12:00:00" }],
    ["제목 타입", { title: 12 }],
    ["장소 타입", { place: {} }],
    ["완료 타입", { isDone: "false" }],
    ["충돌 타입", { conflicts: {} }],
    ["충돌 필드", { conflicts: [{ appointmentId: "9" }] }],
  ])("잘못된 %s 응답 계약을 거부한다", async (_, patch) => {
    stubResponse({ ...response, ...patch });
    await expect(createRemoteAppointment(500, request)).rejects.toMatchObject({
      stage: "response",
    });
  });

  it("201 이외의 성공 상태와 잘못된 JSON을 계약 오류로 구분한다", async () => {
    stubResponse(response, 200);
    await expect(createRemoteAppointment(500, request)).rejects.toBeInstanceOf(
      RemoteAppointmentCreationContractError,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not-json", { status: 201 })),
    );
    await expect(createRemoteAppointment(500, request)).rejects.toBeInstanceOf(
      RemoteAppointmentCreationContractError,
    );
  });

  it.each([400, 401, 403, 404, 500])(
    "HTTP %s 오류를 서버 메시지 노출 없이 보존한다",
    async (status) => {
      stubResponse(
        { errorCode: status === 400 ? 101 : 304, message: "internal secret" },
        status,
      );
      await expect(createRemoteAppointment(500, request)).rejects.toEqual(
        new RemoteAppointmentCreationApiError(
          status,
          status === 400 ? 101 : 304,
        ),
      );
    },
  );

  it("네트워크 오류를 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));
    await expect(createRemoteAppointment(500, request)).rejects.toBeInstanceOf(
      RemoteAppointmentCreationNetworkError,
    );
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
      createRemoteAppointment(500, request),
    ).rejects.toBeInstanceOf(RemoteAppointmentCreationTimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);
    await timedOut;
    const controller = new AbortController();
    const aborted = expect(
      createRemoteAppointment(500, request, controller.signal),
    ).rejects.toBeInstanceOf(RemoteAppointmentCreationRequestAbortedError);
    controller.abort();
    await aborted;
  });
});
