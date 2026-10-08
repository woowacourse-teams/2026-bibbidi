import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseAddedChecklistCatalogItems,
  remoteChecklistDataSource,
  RemoteChecklistApiError,
  RemoteChecklistContractError,
  RemoteChecklistTimeoutError,
} from "./remoteChecklistDataSource";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseAddedChecklistCatalogItems", () => {
  it("추가 응답의 전체 항목과 서버 순서를 보존한다", () => {
    expect(
      parseAddedChecklistCatalogItems({
        items: [
          {
            catalogItemId: 100,
            categoryId: 2,
            createdAt: "2026-09-23T09:00:00",
            id: 1,
            status: "prev",
            title: "계약서 확인",
          },
          {
            catalogItemId: 101,
            categoryId: 3,
            createdAt: "2026-09-23T09:00:00",
            id: 2,
            status: "prev",
            title: "예식장 예약",
          },
        ],
      }),
    ).toEqual([
      {
        catalogItemId: 100,
        categoryId: 2,
        createdAt: "2026-09-23T09:00:00",
        id: 1,
        status: "prev",
        title: "계약서 확인",
      },
      {
        catalogItemId: 101,
        categoryId: 3,
        createdAt: "2026-09-23T09:00:00",
        id: 2,
        status: "prev",
        title: "예식장 예약",
      },
    ]);
  });

  it.each([
    {
      catalogItemId: "100",
      categoryId: 2,
      createdAt: "2026-09-23T09:00:00",
      id: 1,
      status: "prev",
      title: "할 일",
    },
    {
      catalogItemId: 100,
      categoryId: 0,
      createdAt: "2026-09-23T09:00:00",
      id: 1,
      status: "prev",
      title: "할 일",
    },
    {
      catalogItemId: 100,
      categoryId: 2,
      createdAt: "2026-02-30T09:00:00",
      id: 1,
      status: "prev",
      title: "할 일",
    },
    {
      catalogItemId: 100,
      categoryId: 2,
      createdAt: "2026-09-23T09:00:00",
      id: -1,
      status: "prev",
      title: "할 일",
    },
    {
      catalogItemId: 100,
      categoryId: 2,
      createdAt: "2026-09-23T09:00:00",
      id: 1,
      status: "done",
      title: "할 일",
    },
    { catalogItemId: 100, categoryId: 2, id: 1, status: "prev", title: null },
  ])("계약과 다른 추가 성공 항목을 거부한다: %o", (item) => {
    expect(() => parseAddedChecklistCatalogItems({ items: [item] })).toThrow(
      RemoteChecklistContractError,
    );
  });
});

describe("remoteChecklistDataSource.addCatalogItemIds", () => {
  it("세션 쿠키와 JSON ID 배열로 준비 항목을 추가한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              catalogItemId: 100,
              categoryId: 2,
              createdAt: "2026-09-23T09:00:00",
              id: 1,
              status: "prev",
              title: "계약서 확인",
            },
          ],
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remoteChecklistDataSource.addCatalogItemIds([100, 101]),
    ).resolves.toEqual([
      {
        catalogItemId: 100,
        categoryId: 2,
        createdAt: "2026-09-23T09:00:00",
        id: 1,
        status: "prev",
        title: "계약서 확인",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith("/api/checklists/me/catalog-items", {
      body: JSON.stringify([100, 101]),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it("오류 응답의 errorCode와 message를 파싱한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 403,
            message: "이미 추가된 준비 항목입니다.",
          }),
          { status: 409 },
        ),
      ),
    );

    await expect(
      remoteChecklistDataSource.addCatalogItemIds([100]),
    ).rejects.toEqual(
      new RemoteChecklistApiError(403, 409, "이미 추가된 준비 항목입니다."),
    );
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

    const request = remoteChecklistDataSource.addCatalogItemIds([100]);
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteChecklistTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });
});
