import { afterEach, describe, expect, it, vi } from "vitest";
import { preparationCatalogResponseFixture as responseBody } from "../test/fixtures/preparationCatalogResponse.fixture";
import {
  remotePreparationCatalogDataSource,
  RemotePreparationCatalogApiError,
  RemotePreparationCatalogNetworkError,
  RemotePreparationCatalogRequestAbortedError,
  RemotePreparationCatalogTimeoutError,
} from "./remotePreparationCatalogDataSource";
import { parsePreparationCatalogResponse } from "./preparationCatalogResponse";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("remotePreparationCatalogDataSource.getCatalog", () => {
  it("단일 준비 목록 endpoint를 인증 정보 없이 호출한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remotePreparationCatalogDataSource.getCatalog(),
    ).resolves.toEqual(parsePreparationCatalogResponse(responseBody));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/catalog", {
      credentials: "omit",
      method: "GET",
      signal: expect.any(AbortSignal),
    });
  });

  it("HTTP 오류를 상태 코드가 있는 API 오류로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );

    await expect(
      remotePreparationCatalogDataSource.getCatalog(),
    ).rejects.toEqual(new RemotePreparationCatalogApiError(0, 500));
  });

  it("네트워크 오류를 공개 메시지가 있는 오류로 변환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(
      remotePreparationCatalogDataSource.getCatalog(),
    ).rejects.toBeInstanceOf(RemotePreparationCatalogNetworkError);
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

    const request = remotePreparationCatalogDataSource.getCatalog();
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemotePreparationCatalogTimeoutError,
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

    const request = remotePreparationCatalogDataSource.getCatalog();
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemotePreparationCatalogTimeoutError,
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

    const request = remotePreparationCatalogDataSource.getCatalog(
      controller.signal,
    );
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemotePreparationCatalogRequestAbortedError,
    );
    controller.abort();

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

    await expect(
      remotePreparationCatalogDataSource.getCatalog(),
    ).rejects.toThrow("Catalog 성공 응답 형식이 올바르지 않습니다.");
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

    await expect(
      remotePreparationCatalogDataSource.getCatalog(),
    ).rejects.toEqual(
      new RemotePreparationCatalogApiError(201, 401, "로그인이 필요합니다."),
    );
  });
});
