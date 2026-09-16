import { afterEach, describe, expect, it, vi } from "vitest";

import {
  remoteMyChecklistCommandDataSource,
  RemoteChecklistItemChangeApiError,
  RemoteChecklistItemChangeContractError,
  RemoteChecklistItemChangeNetworkError,
  RemoteChecklistItemChangeRequestAbortedError,
  RemoteChecklistItemChangeTimeoutError,
  RemoteCustomChecklistItemCreationApiError,
  RemoteCustomChecklistItemCreationContractError,
  RemoteCustomChecklistItemCreationNetworkError,
  RemoteCustomChecklistItemCreationRequestAbortedError,
  RemoteCustomChecklistItemCreationTimeoutError,
  RemoteMyChecklistCreationApiError,
  RemoteMyChecklistCreationContractError,
  RemoteMyChecklistCreationNetworkError,
  RemoteMyChecklistCreationRequestAbortedError,
  RemoteMyChecklistCreationTimeoutError,
} from "./remoteMyChecklistCommandDataSource";

const changedItemResponse = {
  catalogItemId: null,
  categoryId: 2,
  id: 500,
  status: "continue",
  title: "청첩장 문구 최종 확정",
} as const;

const createdCustomItemResponse = {
  catalogItemId: null,
  categoryId: 2,
  id: 501,
  status: "prev",
  title: "청첩장 문구 정하기",
} as const;

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

describe("remoteMyChecklistCommandDataSource.createCustomChecklistItem", () => {
  it("세션 쿠키와 JSON 본문으로 직접 작성 할 일을 생성한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdCustomItemResponse), {
        status: 201,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remoteMyChecklistCommandDataSource.createCustomChecklistItem(
        "청첩장 문구 정하기",
        2,
      ),
    ).resolves.toEqual(createdCustomItemResponse);
    expect(fetchMock).toHaveBeenCalledWith("/api/checklists/me/items", {
      body: JSON.stringify({
        categoryId: 2,
        title: "청첩장 문구 정하기",
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    [200, createdCustomItemResponse],
    [201, { ...createdCustomItemResponse, id: 0 }],
    [201, { ...createdCustomItemResponse, catalogItemId: 101 }],
    [201, { ...createdCustomItemResponse, categoryId: -1 }],
    [201, { ...createdCustomItemResponse, title: 3 }],
    [201, { ...createdCustomItemResponse, status: "unknown" }],
  ])("생성 성공 상태와 전체 응답 계약을 검증한다", async (status, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
    );

    await expect(
      remoteMyChecklistCommandDataSource.createCustomChecklistItem("제목", 2),
    ).rejects.toBeInstanceOf(RemoteCustomChecklistItemCreationContractError);
  });

  it("API 오류의 상태·코드·메시지를 보존한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 305,
            message: "카테고리를 찾을 수 없습니다.",
          }),
          { status: 404 },
        ),
      ),
    );

    await expect(
      remoteMyChecklistCommandDataSource.createCustomChecklistItem("제목", 2),
    ).rejects.toEqual(
      new RemoteCustomChecklistItemCreationApiError(
        305,
        404,
        "카테고리를 찾을 수 없습니다.",
      ),
    );
  });

  it("네트워크 오류를 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(
      remoteMyChecklistCommandDataSource.createCustomChecklistItem("제목", 2),
    ).rejects.toBeInstanceOf(RemoteCustomChecklistItemCreationNetworkError);
  });

  it("요청이 10초 동안 완료되지 않으면 타임아웃 오류로 변환한다", async () => {
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

    const request =
      remoteMyChecklistCommandDataSource.createCustomChecklistItem("제목", 2);
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteCustomChecklistItemCreationTimeoutError,
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

    const request =
      remoteMyChecklistCommandDataSource.createCustomChecklistItem(
        "제목",
        2,
        controller.signal,
      );
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteCustomChecklistItemCreationRequestAbortedError,
    );
    controller.abort();

    await expectation;
  });

  it("fetch가 abort를 무시하고 응답해도 호출자 취소를 성공으로 처리하지 않는다", async () => {
    const controller = new AbortController();
    let resolveFetch: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );
    const request =
      remoteMyChecklistCommandDataSource.createCustomChecklistItem(
        "제목",
        2,
        controller.signal,
      );
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteCustomChecklistItemCreationRequestAbortedError,
    );

    controller.abort();
    resolveFetch(
      new Response(JSON.stringify(createdCustomItemResponse), { status: 201 }),
    );

    await expectation;
  });

  it("fetch가 내부 abort를 무시하고 늦게 응답해도 타임아웃을 성공으로 처리하지 않는다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            window.setTimeout(() => {
              resolve(
                new Response(JSON.stringify(createdCustomItemResponse), {
                  status: 201,
                }),
              );
            }, 10_001);
          }),
      ),
    );
    const request =
      remoteMyChecklistCommandDataSource.createCustomChecklistItem("제목", 2);
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteCustomChecklistItemCreationTimeoutError,
    );

    await vi.advanceTimersByTimeAsync(10_001);

    await expectation;
  });
});

describe("remoteMyChecklistCommandDataSource.changeChecklistItemCategory", () => {
  it("카테고리 ID를 객체가 아닌 숫자 scalar로 전송한다", async () => {
    const response = { ...changedItemResponse, categoryId: 3 };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remoteMyChecklistCommandDataSource.changeChecklistItemCategory(500, 3),
    ).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checklist-items/500/category",
      {
        body: "3",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
        signal: expect.any(AbortSignal),
      },
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).not.toContain("{");
  });

  it("카테고리 수정 성공 응답 계약과 요청 항목 ID를 검증한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ ...changedItemResponse, categoryId: 0, id: 501 }),
            { status: 200 },
          ),
        ),
    );

    await expect(
      remoteMyChecklistCommandDataSource.changeChecklistItemCategory(500, 3),
    ).rejects.toBeInstanceOf(RemoteChecklistItemChangeContractError);
  });

  it("카테고리 수정 API 오류의 상태·코드·메시지를 보존한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 305,
            message: "카테고리를 찾을 수 없습니다.",
          }),
          { status: 404 },
        ),
      ),
    );

    await expect(
      remoteMyChecklistCommandDataSource.changeChecklistItemCategory(500, 999),
    ).rejects.toEqual(
      new RemoteChecklistItemChangeApiError(
        305,
        404,
        "카테고리를 찾을 수 없습니다.",
      ),
    );
  });
});

describe("remoteMyChecklistCommandDataSource.changeChecklistItemTitle", () => {
  it("제목을 객체나 quoted string으로 감싸지 않은 raw 문자열로 전송한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(changedItemResponse), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      remoteMyChecklistCommandDataSource.changeChecklistItemTitle(
        500,
        "청첩장 문구 최종 확정",
      ),
    ).resolves.toEqual(changedItemResponse);
    expect(fetchMock).toHaveBeenCalledWith("/api/checklist-items/500/title", {
      body: "청첩장 문구 최종 확정",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PUT",
      signal: expect.any(AbortSignal),
    });
    expect(fetchMock.mock.calls[0]?.[1]?.body.startsWith("{")).toBe(false);
    expect(fetchMock.mock.calls[0]?.[1]?.body.startsWith('"')).toBe(false);
  });

  it.each([
    [201, changedItemResponse],
    [200, { ...changedItemResponse, id: 0 }],
    [200, { ...changedItemResponse, id: 501 }],
    [200, { ...changedItemResponse, catalogItemId: -1 }],
    [200, { ...changedItemResponse, categoryId: "2" }],
    [200, { ...changedItemResponse, title: 3 }],
    [200, { ...changedItemResponse, status: "unknown" }],
  ])("성공 응답 전체 계약을 검증한다", async (status, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
    );

    await expect(
      remoteMyChecklistCommandDataSource.changeChecklistItemTitle(
        500,
        "새 제목",
      ),
    ).rejects.toBeInstanceOf(RemoteChecklistItemChangeContractError);
  });

  it("API 오류의 상태와 안전하게 파싱한 서버 메시지를 보존한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: 405,
            message: "준비 목록에서 추가한 할 일은 제목을 변경할 수 없습니다.",
          }),
          { status: 422 },
        ),
      ),
    );

    await expect(
      remoteMyChecklistCommandDataSource.changeChecklistItemTitle(
        500,
        "새 제목",
      ),
    ).rejects.toEqual(
      new RemoteChecklistItemChangeApiError(
        405,
        422,
        "준비 목록에서 추가한 할 일은 제목을 변경할 수 없습니다.",
      ),
    );
  });

  it("네트워크 오류를 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(
      remoteMyChecklistCommandDataSource.changeChecklistItemTitle(
        500,
        "새 제목",
      ),
    ).rejects.toBeInstanceOf(RemoteChecklistItemChangeNetworkError);
  });

  it("요청이 10초 동안 완료되지 않으면 타임아웃 오류로 변환한다", async () => {
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

    const request = remoteMyChecklistCommandDataSource.changeChecklistItemTitle(
      500,
      "새 제목",
    );
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteChecklistItemChangeTimeoutError,
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

    const request = remoteMyChecklistCommandDataSource.changeChecklistItemTitle(
      500,
      "새 제목",
      controller.signal,
    );
    const expectation = expect(request).rejects.toBeInstanceOf(
      RemoteChecklistItemChangeRequestAbortedError,
    );
    controller.abort();

    await expectation;
  });
});
