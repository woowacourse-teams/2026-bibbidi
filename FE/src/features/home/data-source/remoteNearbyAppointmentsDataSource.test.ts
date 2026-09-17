import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseNearbyAppointments,
  remoteNearbyAppointmentsDataSource,
  RemoteNearbyAppointmentsApiError,
  RemoteNearbyAppointmentsContractError,
  RemoteNearbyAppointmentsNetworkError,
  RemoteNearbyAppointmentsRequestAbortedError,
  RemoteNearbyAppointmentsTimeoutError,
} from "./remoteNearbyAppointmentsDataSource";

const validAppointment = {
  checklistItemId: 10,
  date: "2026-09-20",
  endTime: "2026-09-20T15:00:00.123456789",
  id: 1,
  isDone: false,
  memo: "계약서 확인",
  place: "비비디 웨딩홀",
  startTime: "2026-09-20T14:00:00",
  title: "웨딩홀 상담",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseNearbyAppointments", () => {
  it("정상 응답과 nullable 필드를 응답 순서대로 파싱한다", () => {
    const secondAppointment = {
      ...validAppointment,
      endTime: null,
      id: 2,
      memo: null,
      place: null,
      startTime: null,
      title: "시간 미정 일정",
    };

    expect(
      parseNearbyAppointments([validAppointment, secondAppointment], 6),
    ).toEqual([validAppointment, secondAppointment]);
    expect(parseNearbyAppointments([], 6)).toEqual([]);
  });

  it.each([
    ["0인 일정 ID", { id: 0 }],
    ["safe integer가 아닌 체크리스트 ID", { checklistItemId: 2 ** 53 }],
    ["존재하지 않는 날짜", { date: "2026-02-29" }],
    ["잘못된 시작 일시", { startTime: "2026-09-20T24:00:00" }],
    ["timezone이 포함된 종료 일시", { endTime: "2026-09-20T15:00:00Z" }],
    ["문자열이 아닌 제목", { title: 123 }],
    ["문자열이 아닌 장소", { place: false }],
    ["문자열이 아닌 메모", { memo: 123 }],
    ["boolean이 아닌 완료 여부", { isDone: "false" }],
    ["완료된 일정", { isDone: true }],
  ])("%s 응답을 거부한다", (_, patch) => {
    expect(() =>
      parseNearbyAppointments([{ ...validAppointment, ...patch }], 6),
    ).toThrow(RemoteNearbyAppointmentsContractError);
  });

  it("배열이 아닌 성공 응답을 거부한다", () => {
    expect(() => parseNearbyAppointments(validAppointment, 6)).toThrow(
      RemoteNearbyAppointmentsContractError,
    );
  });

  it("요청한 limit보다 많은 성공 응답을 거부한다", () => {
    const appointments = Array.from({ length: 7 }, (_, index) => ({
      ...validAppointment,
      id: index + 1,
    }));

    expect(() => parseNearbyAppointments(appointments, 6)).toThrow(
      RemoteNearbyAppointmentsContractError,
    );
  });
});

describe("remoteNearbyAppointmentsDataSource.getNearbyAppointments", () => {
  it("GET과 세션 쿠키를 사용해 limit 6으로 요청한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([validAppointment]), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remoteNearbyAppointmentsDataSource.getNearbyAppointments(6),
    ).resolves.toEqual([validAppointment]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/appointments/me/nearby?limit=6",
      expect.objectContaining({
        credentials: "include",
        method: "GET",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("HTTP 오류 응답을 API 오류로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
            { status: 401 },
          ),
        ),
    );

    const request = remoteNearbyAppointmentsDataSource.getNearbyAppointments(6);

    await expect(request).rejects.toMatchObject({
      errorCode: 201,
      status: 401,
    });
    await expect(request).rejects.toBeInstanceOf(
      RemoteNearbyAppointmentsApiError,
    );
  });

  it("네트워크 오류를 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed")));

    await expect(
      remoteNearbyAppointmentsDataSource.getNearbyAppointments(6),
    ).rejects.toBeInstanceOf(RemoteNearbyAppointmentsNetworkError);
  });

  it("응답 본문 수신 중 발생한 네트워크 오류를 구분한다", async () => {
    const response = new Response(JSON.stringify([validAppointment]), {
      status: 200,
    });
    vi.spyOn(response, "json").mockRejectedValue(new TypeError("terminated"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(
      remoteNearbyAppointmentsDataSource.getNearbyAppointments(6),
    ).rejects.toBeInstanceOf(RemoteNearbyAppointmentsNetworkError);
  });

  it("timeout을 호출자 취소와 구분한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const request = remoteNearbyAppointmentsDataSource.getNearbyAppointments(6);
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteNearbyAppointmentsTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });

  it("호출자 AbortSignal의 취소를 구분한다", async () => {
    const callerController = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const request = remoteNearbyAppointmentsDataSource.getNearbyAppointments(
      6,
      callerController.signal,
    );
    callerController.abort();

    await expect(request).rejects.toBeInstanceOf(
      RemoteNearbyAppointmentsRequestAbortedError,
    );
  });
});
