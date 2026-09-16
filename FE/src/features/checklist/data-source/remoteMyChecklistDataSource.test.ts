import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseMyChecklist,
  remoteMyChecklistDataSource,
  RemoteMyChecklistApiError,
  RemoteMyChecklistContractError,
  RemoteMyChecklistNetworkError,
  RemoteMyChecklistRequestAbortedError,
  RemoteMyChecklistTimeoutError,
} from "./remoteMyChecklistDataSource";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseMyChecklist", () => {
  it("체크리스트 항목과 일정의 전체 필드를 추출한다", () => {
    expect(
      parseMyChecklist({
        id: 1,
        items: [
          {
            appointments: [
              {
                date: "2026-09-10",
                endTime: "2026-09-10T11:00:00",
                id: 100,
                isDone: false,
                memo: "상담 메모",
                place: "상담 장소",
                startTime: "2026-09-10T10:00:00",
                title: "상담 일정",
              },
            ],
            categoryId: 1,
            id: 10,
            sourceCatalogItemId: 101,
            status: "prev",
            title: "일정이 있는 미완료 항목",
          },
          {
            appointments: [],
            categoryId: 2,
            id: 11,
            sourceCatalogItemId: null,
            status: "continue",
            title: "일정이 없는 진행 중 항목",
          },
          {
            appointments: [],
            categoryId: 2,
            id: 12,
            sourceCatalogItemId: null,
            status: "done",
            title: "완료 항목",
          },
        ],
      }),
    ).toEqual({
      exists: true,
      items: [
        {
          appointments: [
            {
              date: "2026-09-10",
              endTime: "2026-09-10T11:00:00",
              id: 100,
              isDone: false,
              memo: "상담 메모",
              place: "상담 장소",
              startTime: "2026-09-10T10:00:00",
              title: "상담 일정",
            },
          ],
          categoryId: 1,
          id: 10,
          sourceCatalogItemId: 101,
          status: "prev",
          title: "일정이 있는 미완료 항목",
        },
        {
          appointments: [],
          categoryId: 2,
          id: 11,
          sourceCatalogItemId: null,
          status: "continue",
          title: "일정이 없는 진행 중 항목",
        },
        {
          appointments: [],
          categoryId: 2,
          id: 12,
          sourceCatalogItemId: null,
          status: "done",
          title: "완료 항목",
        },
      ],
    });
  });

  it("기존 catalogItemId 필드도 원본 항목 ID로 처리한다", () => {
    expect(
      parseMyChecklist({
        id: 1,
        items: [
          {
            appointments: [],
            catalogItemId: 201,
            categoryId: 1,
            id: 10,
            status: "prev",
            title: "기존 필드 항목",
          },
        ],
      }),
    ).toEqual({
      exists: true,
      items: [
        {
          appointments: [],
          categoryId: 1,
          id: 10,
          sourceCatalogItemId: 201,
          status: "prev",
          title: "기존 필드 항목",
        },
      ],
    });
  });

  it("sourceCatalogItemId가 명시되면 null도 legacy 필드보다 우선한다", () => {
    expect(
      parseMyChecklist({
        id: 1,
        items: [
          {
            appointments: [],
            catalogItemId: 201,
            categoryId: 1,
            id: 10,
            sourceCatalogItemId: null,
            status: "prev",
            title: "직접 작성 항목",
          },
        ],
      }),
    ).toEqual({
      exists: true,
      items: [
        {
          appointments: [],
          categoryId: 1,
          id: 10,
          sourceCatalogItemId: null,
          status: "prev",
          title: "직접 작성 항목",
        },
      ],
    });
  });

  it("빈 items를 처리한다", () => {
    expect(parseMyChecklist({ id: 1, items: [] })).toEqual({
      exists: true,
      items: [],
    });
  });

  it.each([
    { id: 1 },
    {
      id: 1,
      items: [
        {
          appointments: [],
          categoryId: 1,
          id: 10,
          isDone: true,
          sourceCatalogItemId: 101,
          title: "항목",
        },
      ],
    },
    {
      id: 1,
      items: [
        {
          appointments: [],
          categoryId: 1,
          id: 10,
          sourceCatalogItemId: undefined,
          status: "prev",
          title: "항목",
        },
      ],
    },
    {
      id: 1,
      items: [
        {
          appointments: [],
          categoryId: 1,
          id: 10,
          sourceCatalogItemId: "101",
          status: "prev",
          title: "항목",
        },
      ],
    },
    {
      id: 1,
      items: [
        {
          appointments: [
            {
              date: "2026-09-10",
              endTime: undefined,
              id: 100,
              isDone: false,
              memo: null,
              place: null,
              startTime: null,
              title: "일정",
            },
          ],
          categoryId: 1,
          id: 10,
          sourceCatalogItemId: 101,
          status: "prev",
          title: "항목",
        },
      ],
    },
    {
      id: 1,
      items: [
        {
          appointments: [],
          categoryId: 1,
          id: 10,
          sourceCatalogItemId: 101,
          status: "unknown",
          title: "항목",
        },
      ],
    },
    {
      id: 1,
      items: [
        {
          appointments: [],
          categoryId: 1,
          id: 10,
          sourceCatalogItemId: 101,
          status: true,
          title: "항목",
        },
      ],
    },
    { id: "1", items: [] },
  ])("잘못된 성공 응답을 거부한다", (body) => {
    expect(() => parseMyChecklist(body)).toThrow(
      RemoteMyChecklistContractError,
    );
  });

  it.each(["2026/09/10", "2026-9-10", "2026-02-30", "2025-02-29"])(
    "올바르지 않은 일정 날짜 %s를 거부한다",
    (date) => {
      expect(() =>
        parseMyChecklist({
          id: 1,
          items: [
            {
              appointments: [
                {
                  date,
                  endTime: null,
                  id: 100,
                  isDone: false,
                  memo: null,
                  place: null,
                  startTime: null,
                  title: "일정",
                },
              ],
              categoryId: 1,
              id: 10,
              sourceCatalogItemId: 101,
              status: "prev",
              title: "항목",
            },
          ],
        }),
      ).toThrow(RemoteMyChecklistContractError);
    },
  );

  it("윤년의 2월 29일을 허용한다", () => {
    expect(
      parseMyChecklist({
        id: 1,
        items: [
          {
            appointments: [
              {
                date: "2028-02-29",
                endTime: null,
                id: 100,
                isDone: false,
                memo: null,
                place: null,
                startTime: null,
                title: "일정",
              },
            ],
            categoryId: 1,
            id: 10,
            sourceCatalogItemId: 101,
            status: "prev",
            title: "항목",
          },
        ],
      }).items[0]?.appointments[0]?.date,
    ).toBe("2028-02-29");
  });
});

describe("remoteMyChecklistDataSource.getChecklist", () => {
  it("세션 쿠키를 포함해 내 체크리스트를 조회한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          items: [
            {
              appointments: [],
              categoryId: 1,
              id: 10,
              sourceCatalogItemId: 101,
              status: "done",
              title: "웨딩홀 계약",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(remoteMyChecklistDataSource.getChecklist()).resolves.toEqual({
      exists: true,
      items: [
        {
          appointments: [],
          categoryId: 1,
          id: 10,
          sourceCatalogItemId: 101,
          status: "done",
          title: "웨딩홀 계약",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/checklists/me", {
      credentials: "include",
      method: "GET",
      signal: expect.any(AbortSignal),
    });
  });

  it("HTTP 오류의 상태와 오류 코드를 보존한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 201,
            message: "로그인이 필요합니다.",
          }),
          { status: 401 },
        ),
      ),
    );

    await expect(remoteMyChecklistDataSource.getChecklist()).rejects.toEqual(
      new RemoteMyChecklistApiError(201, 401, "로그인이 필요합니다."),
    );
  });

  it("네트워크 오류를 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(
      remoteMyChecklistDataSource.getChecklist(),
    ).rejects.toBeInstanceOf(RemoteMyChecklistNetworkError);
  });

  it("10초 동안 응답이 없으면 타임아웃 오류로 변환한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      ),
    );

    const request = remoteMyChecklistDataSource.getChecklist();
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteMyChecklistTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });

  it("호출자의 요청 취소를 별도 오류로 변환한다", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      ),
    );

    const request = remoteMyChecklistDataSource.getChecklist(controller.signal);
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteMyChecklistRequestAbortedError,
    );
    controller.abort();

    await expectation;
  });
});
