import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPublicPreparationCatalog,
  PublicPreparationCatalogApiError,
  PublicPreparationCatalogNetworkError,
  PublicPreparationCatalogTimeoutError,
} from "./getPublicPreparationCatalog";
import { parsePreparationCatalogResponse } from "./preparationCatalogResponse";

const responseBody = {
  categories: [
    {
      displayOrder: 2,
      id: 20,
      name: "두 번째 카테고리",
      steps: [],
    },
    {
      displayOrder: 1,
      id: 10,
      name: "첫 번째 카테고리",
      steps: [
        {
          description: null,
          displayOrder: 1,
          iconUrl: null,
          id: 100,
          items: [
            {
              displayOrder: 2,
              essential: false,
              id: 1002,
              title: "두 번째 할 일",
            },
            {
              displayOrder: 1,
              essential: true,
              id: 1001,
              title: "첫 번째 할 일",
            },
          ],
          name: "준비 단계",
        },
      ],
    },
  ],
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parsePreparationCatalogResponse", () => {
  it("공개 응답을 표시 순서에 맞는 화면 모델로 변환한다", () => {
    const model = parsePreparationCatalogResponse(responseBody);

    expect(model.categories.map((category) => category.id)).toEqual([
      "10",
      "20",
    ]);
    expect(model.roadmaps[0].steps[0]).toEqual({
      iconUrl: undefined,
      id: "100",
      order: 1,
      title: "준비 단계",
    });
    expect(model.stepDetails[0]).toEqual({
      description: "",
      stepId: "100",
      tasks: [
        {
          essential: true,
          id: "1001",
          included: undefined,
          title: "첫 번째 할 일",
        },
        {
          essential: false,
          id: "1002",
          included: undefined,
          title: "두 번째 할 일",
        },
      ],
    });
  });

  it("nullable 선택 필드가 생략된 응답도 처리한다", () => {
    const responseWithoutOptionalFields = structuredClone(responseBody);
    Reflect.deleteProperty(
      responseWithoutOptionalFields.categories[1].steps[0],
      "description",
    );
    Reflect.deleteProperty(
      responseWithoutOptionalFields.categories[1].steps[0],
      "iconUrl",
    );

    expect(() =>
      parsePreparationCatalogResponse(responseWithoutOptionalFields),
    ).not.toThrow();
  });
});

describe("getPublicPreparationCatalog", () => {
  it("공개 준비 목록 endpoint를 인증 정보 없이 호출한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicPreparationCatalog()).resolves.toEqual(
      parsePreparationCatalogResponse(responseBody),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/catalog/public", {
      method: "GET",
      signal: expect.any(AbortSignal),
    });
  });

  it("HTTP 오류를 상태 코드가 있는 API 오류로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );

    await expect(getPublicPreparationCatalog()).rejects.toEqual(
      new PublicPreparationCatalogApiError(500),
    );
  });

  it("네트워크 오류를 공개 메시지가 있는 오류로 변환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(getPublicPreparationCatalog()).rejects.toBeInstanceOf(
      PublicPreparationCatalogNetworkError,
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

    const request = getPublicPreparationCatalog();
    const expectation = expect(request).rejects.toBeInstanceOf(
      PublicPreparationCatalogTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });

  it("응답 본문이 10초 동안 완료되지 않아도 타임아웃 오류로 변환한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) =>
        Promise.resolve({
          json: () =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
          ok: true,
        } satisfies Pick<Response, "json" | "ok">),
      ),
    );

    const request = getPublicPreparationCatalog();
    const expectation = expect(request).rejects.toBeInstanceOf(
      PublicPreparationCatalogTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });

  it("계약과 다른 성공 응답은 거부한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ categories: [{ id: "wrong" }] }), {
          status: 200,
        }),
      ),
    );

    await expect(getPublicPreparationCatalog()).rejects.toThrow(
      "준비 목록 성공 응답 형식이 올바르지 않습니다.",
    );
  });
});
