import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseUnscheduledTasks,
  remoteUnscheduledTasksDataSource,
  RemoteUnscheduledTasksApiError,
  RemoteUnscheduledTasksContractError,
  RemoteUnscheduledTasksNetworkError,
  RemoteUnscheduledTasksRequestAbortedError,
  RemoteUnscheduledTasksTimeoutError,
} from "./remoteUnscheduledTasksDataSource";

const validTask = {
  categoryName: "웨딩홀",
  checklistItemId: 31,
  status: "prev" as const,
  title: "웨딩홀 투어",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseUnscheduledTasks", () => {
  it("정상 응답과 빈 배열을 응답 순서대로 파싱한다", () => {
    const secondTask = {
      categoryName: "가족",
      checklistItemId: 44,
      status: "continue" as const,
      title: "부모님께 인사",
    };
    const thirdTask = {
      categoryName: "예식",
      checklistItemId: 52,
      status: "prev" as const,
      title: "식순 준비",
    };

    expect(
      parseUnscheduledTasks([validTask, secondTask, thirdTask], 3),
    ).toEqual([validTask, secondTask, thirdTask]);
    expect(parseUnscheduledTasks([], 3)).toEqual([]);
  });

  it.each([
    ["0인 할 일 ID", { checklistItemId: 0 }],
    ["safe integer가 아닌 할 일 ID", { checklistItemId: 2 ** 53 }],
    ["문자열이 아닌 제목", { title: 123 }],
    ["문자열이 아닌 카테고리", { categoryName: null }],
    ["지원하지 않는 상태", { status: "done" }],
  ])("%s 응답을 거부한다", (_, patch) => {
    expect(() =>
      parseUnscheduledTasks([{ ...validTask, ...patch }], 3),
    ).toThrow(RemoteUnscheduledTasksContractError);
  });

  it("배열이 아닌 성공 응답을 거부한다", () => {
    expect(() => parseUnscheduledTasks(validTask, 3)).toThrow(
      RemoteUnscheduledTasksContractError,
    );
  });

  it("요청한 limit보다 많은 성공 응답을 거부한다", () => {
    const tasks = Array.from({ length: 4 }, (_, index) => ({
      ...validTask,
      checklistItemId: index + 1,
    }));

    expect(() => parseUnscheduledTasks(tasks, 3)).toThrow(
      RemoteUnscheduledTasksContractError,
    );
  });
});

describe("remoteUnscheduledTasksDataSource.getUnscheduledTasks", () => {
  it("GET과 세션 쿠키를 사용해 limit 3으로 요청한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([validTask]), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remoteUnscheduledTasksDataSource.getUnscheduledTasks(3),
    ).resolves.toEqual([validTask]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checklists/me/unscheduled-items?limit=3",
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
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ errorCode: 303, message: "내부 서버 메시지" }),
            { status: 404 },
          ),
        ),
    );

    const request = remoteUnscheduledTasksDataSource.getUnscheduledTasks(3);

    await expect(request).rejects.toMatchObject({
      errorCode: 303,
      status: 404,
    });
    await expect(request).rejects.toBeInstanceOf(
      RemoteUnscheduledTasksApiError,
    );
  });

  it("잘못된 성공 JSON을 계약 오류로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid", { status: 200 })),
    );

    await expect(
      remoteUnscheduledTasksDataSource.getUnscheduledTasks(3),
    ).rejects.toBeInstanceOf(RemoteUnscheduledTasksContractError);
  });

  it("잘못된 오류 JSON도 HTTP 상태를 보존한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid", { status: 401 })),
    );

    await expect(
      remoteUnscheduledTasksDataSource.getUnscheduledTasks(3),
    ).rejects.toMatchObject({ status: 401, errorCode: 0 });
  });

  it("네트워크 오류를 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed")));

    await expect(
      remoteUnscheduledTasksDataSource.getUnscheduledTasks(3),
    ).rejects.toBeInstanceOf(RemoteUnscheduledTasksNetworkError);
  });

  it("응답 본문 수신 중 발생한 네트워크 오류를 구분한다", async () => {
    const response = new Response(JSON.stringify([validTask]), { status: 200 });
    vi.spyOn(response, "json").mockRejectedValue(new TypeError("terminated"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(
      remoteUnscheduledTasksDataSource.getUnscheduledTasks(3),
    ).rejects.toBeInstanceOf(RemoteUnscheduledTasksNetworkError);
  });

  it("timeout을 호출자 취소와 구분한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const request = remoteUnscheduledTasksDataSource.getUnscheduledTasks(3);
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteUnscheduledTasksTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });

  it("호출자 AbortSignal의 취소를 구분한다", async () => {
    const callerController = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const request = remoteUnscheduledTasksDataSource.getUnscheduledTasks(
      3,
      callerController.signal,
    );
    callerController.abort();

    await expect(request).rejects.toBeInstanceOf(
      RemoteUnscheduledTasksRequestAbortedError,
    );
  });

  it("응답 본문을 받는 중 호출자가 취소하면 취소 오류로 변환한다", async () => {
    const callerController = new AbortController();
    const response = new Response(JSON.stringify([validTask]), { status: 200 });
    vi.spyOn(response, "json").mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          callerController.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const request = remoteUnscheduledTasksDataSource.getUnscheduledTasks(
      3,
      callerController.signal,
    );
    callerController.abort();

    await expect(request).rejects.toBeInstanceOf(
      RemoteUnscheduledTasksRequestAbortedError,
    );
  });

  it("취소를 무시하고 도착한 늦은 fetch 응답도 노출하지 않는다", async () => {
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

    const request = remoteUnscheduledTasksDataSource.getUnscheduledTasks(
      3,
      callerController.signal,
    );
    callerController.abort();
    resolveFetch(new Response(JSON.stringify([validTask]), { status: 200 }));

    await expect(request).rejects.toBeInstanceOf(
      RemoteUnscheduledTasksRequestAbortedError,
    );
  });
});
