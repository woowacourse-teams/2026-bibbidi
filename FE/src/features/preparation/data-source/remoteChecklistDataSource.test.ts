import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseAddedChecklistCatalogItemIds,
  remoteChecklistDataSource,
  RemoteChecklistApiError,
  RemoteChecklistTimeoutError,
} from "./remoteChecklistDataSource";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseAddedChecklistCatalogItemIds", () => {
  it("추가 응답에서 원본 준비 항목 ID를 중복 없이 추출한다", () => {
    expect(
      parseAddedChecklistCatalogItemIds({
        items: [
          { catalogItemId: 100, id: 1 },
          { catalogItemId: 101, id: 2 },
          { catalogItemId: 100, id: 3 },
        ],
      }),
    ).toEqual([100, 101]);
  });

  it("계약과 다른 추가 성공 응답을 거부한다", () => {
    expect(() =>
      parseAddedChecklistCatalogItemIds({
        items: [{ catalogItemId: "100", id: 1 }],
      }),
    ).toThrow("체크리스트 추가 성공 응답 형식이 올바르지 않습니다.");
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
    ).resolves.toEqual([100]);
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
