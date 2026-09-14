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
  it("헤더와 준비 목록에 필요한 필드를 함께 추출한다", () => {
    expect(
      parseMyChecklist({
        id: 1,
        items: [
          {
            appointments: [],
            id: 10,
            isDone: true,
            sourceCatalogItemId: 101,
          },
          {
            appointments: [{}],
            id: 11,
            isDone: false,
            sourceCatalogItemId: null,
          },
        ],
      }),
    ).toEqual({
      items: [
        { isDone: true, sourceCatalogItemId: 101 },
        { isDone: false, sourceCatalogItemId: null },
      ],
    });
  });

  it("기존 catalogItemId 필드도 원본 항목 ID로 처리한다", () => {
    expect(
      parseMyChecklist({
        id: 1,
        items: [{ catalogItemId: 201, id: 10, isDone: false }],
      }),
    ).toEqual({
      items: [{ isDone: false, sourceCatalogItemId: 201 }],
    });
  });

  it("빈 items를 처리한다", () => {
    expect(parseMyChecklist({ id: 1, items: [] })).toEqual({ items: [] });
  });

  it.each([
    { id: 1 },
    { id: 1, items: [{ isDone: "true", sourceCatalogItemId: 101 }] },
    { id: 1, items: [{ isDone: true, sourceCatalogItemId: "101" }] },
    { id: "1", items: [] },
  ])("잘못된 성공 응답을 거부한다", (body) => {
    expect(() => parseMyChecklist(body)).toThrow(
      RemoteMyChecklistContractError,
    );
  });
});

describe("remoteMyChecklistDataSource.getChecklist", () => {
  it("세션 쿠키를 포함해 내 체크리스트를 조회한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          items: [{ id: 10, isDone: true, sourceCatalogItemId: 101 }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(remoteMyChecklistDataSource.getChecklist()).resolves.toEqual({
      items: [{ isDone: true, sourceCatalogItemId: 101 }],
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
