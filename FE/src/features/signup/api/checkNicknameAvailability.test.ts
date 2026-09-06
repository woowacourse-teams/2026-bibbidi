import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkNicknameAvailability,
  NicknameAvailabilityApiError,
  NicknameAvailabilityNetworkError,
  NicknameAvailabilityTimeoutError,
} from "./checkNicknameAvailability";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("checkNicknameAvailability", () => {
  it("닉네임을 query parameter로 전달한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ available: true, nickname: "bibbidi name" }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkNicknameAvailability("bibbidi name")).resolves.toEqual({
      available: true,
      nickname: "bibbidi name",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users/nickname/availability?nickname=bibbidi+name",
      {
        method: "GET",
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("성공하지 않은 응답을 API 오류로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 101,
            errors: [
              {
                field: "nickname",
                message: "닉네임 형식이 올바르지 않습니다.",
              },
            ],
            message: "요청 값이 올바르지 않습니다.",
          }),
          { status: 400 },
        ),
      ),
    );

    await expect(checkNicknameAvailability("invalid")).rejects.toEqual(
      new NicknameAvailabilityApiError(
        101,
        400,
        "요청 값이 올바르지 않습니다.",
        [
          {
            field: "nickname",
            message: "닉네임 형식이 올바르지 않습니다.",
          },
        ],
      ),
    );
  });

  it("요청과 다른 닉네임의 응답을 거부한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ available: true, nickname: "other-name" }),
            { status: 200 },
          ),
        ),
    );

    await expect(checkNicknameAvailability("bibbidi")).rejects.toThrow(
      "닉네임 중복 확인 응답의 닉네임이 일치하지 않습니다.",
    );
  });

  it("요청 실패를 네트워크 오류로 변환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(checkNicknameAvailability("bibbidi")).rejects.toBeInstanceOf(
      NicknameAvailabilityNetworkError,
    );
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
      checkNicknameAvailability("bibbidi"),
    ).rejects.toBeInstanceOf(NicknameAvailabilityTimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);

    await requestExpectation;
  });
});
