import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseWeddingDateResponse,
  RemoteWeddingDateApiError,
  RemoteWeddingDateContractError,
  RemoteWeddingDateNetworkError,
  RemoteWeddingDateRequestAbortedError,
  RemoteWeddingDateTimeoutError,
  remoteWeddingDateDataSource,
} from "./remoteWeddingDateDataSource";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("remoteWeddingDateDataSource", () => {
  it("GET과 PUT에 정확한 URL, 쿠키, JSON 본문을 사용한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ weddingDate: null }))
      .mockResolvedValueOnce(jsonResponse({ weddingDate: "2027-05-15" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remoteWeddingDateDataSource.getWeddingDate(),
    ).resolves.toBeNull();
    await expect(
      remoteWeddingDateDataSource.saveWeddingDate("2027-05-15"),
    ).resolves.toBe("2027-05-15");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/users/me/wedding-date", {
      credentials: "include",
      method: "GET",
      signal: expect.any(AbortSignal),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/users/me/wedding-date", {
      body: '{"weddingDate":"2027-05-15"}',
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PUT",
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    [{ weddingDate: "2024-02-29" }, "2024-02-29"],
    [{ weddingDate: null }, null],
  ])("정상 날짜와 null 응답을 파싱한다", (body, expected) => {
    expect(parseWeddingDateResponse(body)).toBe(expected);
  });

  it.each([
    {},
    { weddingDate: undefined },
    { weddingDate: "2027-02-29" },
    { weddingDate: "2027-13-01" },
    { weddingDate: "2027-05-1" },
    { weddingDate: 1 },
    null,
  ])("잘못된 날짜 응답을 거부한다", (body) => {
    expect(() => parseWeddingDateResponse(body)).toThrow(
      RemoteWeddingDateContractError,
    );
  });

  it("PUT에서 null 응답과 잘못된 입력을 거부한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ weddingDate: null }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      remoteWeddingDateDataSource.saveWeddingDate("2027-05-15"),
    ).rejects.toBeInstanceOf(RemoteWeddingDateContractError);
    await expect(
      remoteWeddingDateDataSource.saveWeddingDate("2027-02-30"),
    ).rejects.toBeInstanceOf(RemoteWeddingDateContractError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([400, 401, 500])(
    "HTTP %i를 API 오류로 변환하고 내부 메시지를 노출하지 않는다",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            jsonResponse(
              { errorCode: 201, message: "internal secret" },
              status,
            ),
          ),
      );
      try {
        await remoteWeddingDateDataSource.getWeddingDate();
        throw new Error("expected rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(RemoteWeddingDateApiError);
        expect((error as RemoteWeddingDateApiError).status).toBe(status);
        expect((error as RemoteWeddingDateApiError).message).not.toContain(
          "internal secret",
        );
      }
    },
  );

  it("네트워크 오류와 잘못된 JSON 성공 응답을 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(
      remoteWeddingDateDataSource.getWeddingDate(),
    ).rejects.toBeInstanceOf(RemoteWeddingDateNetworkError);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid", { status: 200 })),
    );
    await expect(
      remoteWeddingDateDataSource.getWeddingDate(),
    ).rejects.toBeInstanceOf(RemoteWeddingDateContractError);
  });

  it("타임아웃과 호출자 취소를 구분한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );
    const timedOut = remoteWeddingDateDataSource.getWeddingDate();
    const timeoutExpectation = expect(timedOut).rejects.toBeInstanceOf(
      RemoteWeddingDateTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await timeoutExpectation;

    const controller = new AbortController();
    const cancelled = remoteWeddingDateDataSource.getWeddingDate(
      controller.signal,
    );
    const cancelExpectation = expect(cancelled).rejects.toBeInstanceOf(
      RemoteWeddingDateRequestAbortedError,
    );
    controller.abort();
    await cancelExpectation;
  });

  it("응답 본문을 읽는 중 취소되면 사용자 오류 대신 취소로 처리한다", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          new Promise((_resolve, reject) =>
            controller.signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            ),
          ),
        ok: true,
        status: 200,
      }),
    );
    const request = remoteWeddingDateDataSource.getWeddingDate(
      controller.signal,
    );
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteWeddingDateRequestAbortedError,
    );
    await Promise.resolve();
    controller.abort();
    await expectation;
  });
});
