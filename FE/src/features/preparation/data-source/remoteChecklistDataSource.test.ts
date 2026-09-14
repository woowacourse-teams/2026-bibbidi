import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseChecklistCatalogItemIds,
  remoteChecklistDataSource,
  RemoteChecklistApiError,
  RemoteChecklistNetworkError,
  RemoteChecklistTimeoutError,
} from "./remoteChecklistDataSource";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseChecklistCatalogItemIds", () => {
  it("원본 준비 항목 ID만 중복 없이 추출한다", () => {
    expect(
      parseChecklistCatalogItemIds({
        id: 1,
        items: [
          { id: 1, sourceCatalogItemId: 101 },
          { id: 2, sourceCatalogItemId: null },
          { id: 3, sourceCatalogItemId: 101 },
          { id: 4, sourceCatalogItemId: 102 },
        ],
      }),
    ).toEqual([101, 102]);
  });

  it("catalogItemId 필드도 호환해 처리한다", () => {
    expect(
      parseChecklistCatalogItemIds({
        id: 1,
        items: [{ catalogItemId: 201, id: 1 }],
      }),
    ).toEqual([201]);
  });

  it("items가 생략된 빈 체크리스트를 처리한다", () => {
    expect(parseChecklistCatalogItemIds({ id: 1 })).toEqual([]);
  });

  it("계약과 다른 성공 응답은 거부한다", () => {
    expect(() =>
      parseChecklistCatalogItemIds({
        id: 1,
        items: [{ id: 1, sourceCatalogItemId: "101" }],
      }),
    ).toThrow("체크리스트 성공 응답 형식이 올바르지 않습니다.");
  });
});

describe("remoteChecklistDataSource.getCatalogItemIds", () => {
  it("세션 쿠키를 포함해 내 체크리스트를 조회한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          items: [{ id: 1, sourceCatalogItemId: 101 }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remoteChecklistDataSource.getCatalogItemIds(),
    ).resolves.toEqual([101]);
    expect(fetchMock).toHaveBeenCalledWith("/api/checklists/me", {
      credentials: "include",
      method: "GET",
      signal: expect.any(AbortSignal),
    });
  });

  it("오류 응답의 코드와 상태를 API 오류로 변환한다", async () => {
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

    await expect(remoteChecklistDataSource.getCatalogItemIds()).rejects.toEqual(
      new RemoteChecklistApiError(201, 401, "로그인이 필요합니다."),
    );
  });

  it("네트워크 오류를 공개 메시지가 있는 오류로 변환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(
      remoteChecklistDataSource.getCatalogItemIds(),
    ).rejects.toBeInstanceOf(RemoteChecklistNetworkError);
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

    const request = remoteChecklistDataSource.getCatalogItemIds();
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteChecklistTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });
});
