import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseRecommendedCatalogItems,
  remoteRecommendedCatalogItemsDataSource,
  RemoteRecommendedCatalogItemsApiError,
  RemoteRecommendedCatalogItemsContractError,
  RemoteRecommendedCatalogItemsNetworkError,
  RemoteRecommendedCatalogItemsRequestAbortedError,
  RemoteRecommendedCatalogItemsTimeoutError,
} from "./remoteRecommendedCatalogItemsDataSource";

const validItem = {
  catalogItemId: 201,
  categoryName: "스드메",
  phase: 2,
  stepName: "스드메 업체 확정",
  title: "드레스샵 확정",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseRecommendedCatalogItems", () => {
  it("정상 응답과 빈 배열을 응답 순서대로 파싱한다", () => {
    const nextItem = {
      ...validItem,
      catalogItemId: 100,
      categoryName: "웨딩홀",
      phase: 1,
      stepName: "웨딩홀 정하기",
      title: "웨딩홀 투어",
    };

    expect(parseRecommendedCatalogItems([validItem, nextItem], 4)).toEqual([
      validItem,
      nextItem,
    ]);
    expect(parseRecommendedCatalogItems([], 4)).toEqual([]);
  });

  it.each([
    ["0인 ID", { catalogItemId: 0 }],
    ["safe integer가 아닌 ID", { catalogItemId: 2 ** 53 }],
    ["문자열이 아닌 제목", { title: 123 }],
    ["문자열이 아닌 카테고리", { categoryName: null }],
    ["0인 phase", { phase: 0 }],
    ["정수가 아닌 phase", { phase: 1.5 }],
    ["문자열이 아닌 단계 이름", { stepName: null }],
  ])("%s 응답을 거부한다", (_, patch) => {
    expect(() =>
      parseRecommendedCatalogItems([{ ...validItem, ...patch }], 4),
    ).toThrow(RemoteRecommendedCatalogItemsContractError);
  });

  it("배열이 아닌 응답과 limit 초과 응답을 거부한다", () => {
    expect(() => parseRecommendedCatalogItems(validItem, 4)).toThrow(
      RemoteRecommendedCatalogItemsContractError,
    );
    expect(() =>
      parseRecommendedCatalogItems(
        Array.from({ length: 5 }, (_, index) => ({
          ...validItem,
          catalogItemId: index + 1,
        })),
        4,
      ),
    ).toThrow(RemoteRecommendedCatalogItemsContractError);
  });
});

describe("remoteRecommendedCatalogItemsDataSource.getRecommendedCatalogItems", () => {
  it("GET과 세션 쿠키를 사용해 limit 4로 요청한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([validItem]), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remoteRecommendedCatalogItemsDataSource.getRecommendedCatalogItems(4),
    ).resolves.toEqual([validItem]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checklists/me/recommended-catalog-items?limit=4",
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
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ errorCode: 303, message: "내부 서버 메시지" }),
          {
            status: 404,
          },
        ),
      ),
    );

    const request =
      remoteRecommendedCatalogItemsDataSource.getRecommendedCatalogItems(4);
    await expect(request).rejects.toMatchObject({
      errorCode: 303,
      status: 404,
    });
    await expect(request).rejects.toBeInstanceOf(
      RemoteRecommendedCatalogItemsApiError,
    );
  });

  it("잘못된 성공 JSON은 계약 오류, 잘못된 오류 JSON은 HTTP 상태를 보존한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid", { status: 200 })),
    );
    await expect(
      remoteRecommendedCatalogItemsDataSource.getRecommendedCatalogItems(4),
    ).rejects.toBeInstanceOf(RemoteRecommendedCatalogItemsContractError);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid", { status: 401 })),
    );
    await expect(
      remoteRecommendedCatalogItemsDataSource.getRecommendedCatalogItems(4),
    ).rejects.toMatchObject({ errorCode: 0, status: 401 });
  });

  it("네트워크 오류와 본문 수신 중 네트워크 오류를 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed")));
    await expect(
      remoteRecommendedCatalogItemsDataSource.getRecommendedCatalogItems(4),
    ).rejects.toBeInstanceOf(RemoteRecommendedCatalogItemsNetworkError);

    const response = new Response(JSON.stringify([validItem]), { status: 200 });
    vi.spyOn(response, "json").mockRejectedValue(new TypeError("terminated"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(
      remoteRecommendedCatalogItemsDataSource.getRecommendedCatalogItems(4),
    ).rejects.toBeInstanceOf(RemoteRecommendedCatalogItemsNetworkError);
  });

  it("timeout을 호출자 취소와 구분한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );

    const request =
      remoteRecommendedCatalogItemsDataSource.getRecommendedCatalogItems(4);
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteRecommendedCatalogItemsTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await expectation;
  });

  it("호출자 AbortSignal과 늦은 fetch 응답을 취소로 처리한다", async () => {
    const callerController = new AbortController();
    let resolveFetch: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    const request =
      remoteRecommendedCatalogItemsDataSource.getRecommendedCatalogItems(
        4,
        callerController.signal,
      );
    callerController.abort();
    resolveFetch(new Response(JSON.stringify([validItem]), { status: 200 }));

    await expect(request).rejects.toBeInstanceOf(
      RemoteRecommendedCatalogItemsRequestAbortedError,
    );
  });

  it("응답 본문 수신 중 호출자 취소를 구분한다", async () => {
    const callerController = new AbortController();
    const response = new Response(JSON.stringify([validItem]), { status: 200 });
    vi.spyOn(response, "json").mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          callerController.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const request =
      remoteRecommendedCatalogItemsDataSource.getRecommendedCatalogItems(
        4,
        callerController.signal,
      );
    callerController.abort();

    await expect(request).rejects.toBeInstanceOf(
      RemoteRecommendedCatalogItemsRequestAbortedError,
    );
  });
});
