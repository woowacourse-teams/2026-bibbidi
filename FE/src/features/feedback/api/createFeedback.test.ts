import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFeedback,
  CreateFeedbackApiError,
  CreateFeedbackNetworkError,
  CreateFeedbackTimeoutError,
} from "./createFeedback";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createFeedback", () => {
  it("피드백 생성 endpoint에 공개 요청을 전송한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createFeedback({ content: "좋았어요", sentiment: "good" }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/feedbacks", {
      body: JSON.stringify({ content: "좋았어요", sentiment: "good" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it("201이 아닌 응답을 API 오류로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 400 })),
    );

    await expect(
      createFeedback({ content: null, sentiment: "bad" }),
    ).rejects.toEqual(new CreateFeedbackApiError(400));
  });

  it("요청 실패를 네트워크 오류로 변환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(
      createFeedback({ content: null, sentiment: "bad" }),
    ).rejects.toBeInstanceOf(CreateFeedbackNetworkError);
  });

  it("10초가 지나면 요청을 중단하고 Timeout 오류를 반환한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      ),
    );

    const requestExpectation = expect(
      createFeedback({ content: null, sentiment: "good" }),
    ).rejects.toBeInstanceOf(CreateFeedbackTimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);

    await requestExpectation;
  });
});
