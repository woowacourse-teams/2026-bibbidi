import { afterEach, describe, expect, it, vi } from "vitest";

import {
  remoteMyChecklistCommandDataSource,
  RemoteMyChecklistCreationApiError,
  RemoteMyChecklistCreationContractError,
  RemoteMyChecklistCreationNetworkError,
  RemoteMyChecklistCreationRequestAbortedError,
  RemoteMyChecklistCreationTimeoutError,
} from "./remoteMyChecklistCommandDataSource";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("remoteMyChecklistCommandDataSource.createChecklist", () => {
  it("세션 쿠키를 포함해 빈 체크리스트를 생성하고 ID를 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(41), {
        status: 201,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remoteMyChecklistCommandDataSource.createChecklist(),
    ).resolves.toBe(41);
    expect(fetchMock).toHaveBeenCalledWith("/api/checklists", {
      credentials: "include",
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    [200, 41],
    [201, "41"],
    [201, 0],
    [201, null],
  ])("성공 상태와 체크리스트 ID 계약을 검증한다", async (status, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
    );

    await expect(
      remoteMyChecklistCommandDataSource.createChecklist(),
    ).rejects.toBeInstanceOf(RemoteMyChecklistCreationContractError);
  });

  it("생성 오류 응답의 errorCode와 message를 보존한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 402,
            message: "이미 체크리스트가 존재합니다.",
          }),
          { status: 409 },
        ),
      ),
    );

    await expect(
      remoteMyChecklistCommandDataSource.createChecklist(),
    ).rejects.toEqual(
      new RemoteMyChecklistCreationApiError(
        402,
        409,
        "이미 체크리스트가 존재합니다.",
      ),
    );
  });

  it("생성 네트워크 오류를 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(
      remoteMyChecklistCommandDataSource.createChecklist(),
    ).rejects.toBeInstanceOf(RemoteMyChecklistCreationNetworkError);
  });

  it("생성 요청이 10초 동안 완료되지 않으면 타임아웃 오류로 변환한다", async () => {
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

    const request = remoteMyChecklistCommandDataSource.createChecklist();
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteMyChecklistCreationTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });

  it("생성 호출자의 요청 취소를 별도 오류로 변환한다", async () => {
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

    const request = remoteMyChecklistCommandDataSource.createChecklist(
      controller.signal,
    );
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteMyChecklistCreationRequestAbortedError,
    );
    controller.abort();

    await expectation;
  });
});
