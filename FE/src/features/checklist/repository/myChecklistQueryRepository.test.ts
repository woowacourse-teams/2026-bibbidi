import { describe, expect, it, vi } from "vitest";

import {
  RemoteMyChecklistApiError,
  RemoteMyChecklistDataSource,
  RemoteMyChecklistNetworkError,
  RemoteMyChecklistRequestAbortedError,
} from "../data-source/remoteMyChecklistDataSource";
import { MyChecklistModel } from "../model/myChecklist";
import {
  createMyChecklistQueryRepository,
  MyChecklistAuthenticationRequiredError,
  MyChecklistLoadError,
  MyChecklistRequestAbortedError,
} from "./myChecklistQueryRepository";

const checklist: MyChecklistModel = {
  items: [{ isDone: true, sourceCatalogItemId: 101 }],
};

function createDataSource(): RemoteMyChecklistDataSource {
  return { getChecklist: vi.fn() };
}

describe("MyChecklistQueryRepository", () => {
  it("동일한 인증 사용자의 진행 중 요청과 결과를 공유한다", async () => {
    let resolveChecklist: (value: MyChecklistModel) => void = () => undefined;
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockReturnValue(
      new Promise((resolve) => {
        resolveChecklist = resolve;
      }),
    );
    const repository = createMyChecklistQueryRepository(dataSource);
    const headerRequest = repository.getChecklist();
    const preparationRequest = repository.getChecklist();

    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
    resolveChecklist(checklist);
    await expect(headerRequest).resolves.toBe(checklist);
    await expect(preparationRequest).resolves.toBe(checklist);
    await expect(repository.getChecklist()).resolves.toBe(checklist);
    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
  });

  it("한 구독자가 취소돼도 다른 구독자가 있으면 공통 요청을 유지한다", async () => {
    let resolveChecklist: (value: MyChecklistModel) => void = () => undefined;
    let dataSourceSignal: AbortSignal | undefined;
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockImplementation((signal) => {
      dataSourceSignal = signal;
      return new Promise((resolve) => {
        resolveChecklist = resolve;
      });
    });
    const repository = createMyChecklistQueryRepository(dataSource);
    const headerController = new AbortController();

    const headerRequest = repository.getChecklist(headerController.signal);
    const preparationRequest = repository.getChecklist();
    const headerExpectation = expect(headerRequest).rejects.toBeInstanceOf(
      MyChecklistRequestAbortedError,
    );
    headerController.abort();

    await headerExpectation;
    expect(dataSourceSignal?.aborted).toBe(false);
    resolveChecklist(checklist);
    await expect(preparationRequest).resolves.toBe(checklist);
  });

  it("모든 구독자가 취소되면 공통 요청을 취소한다", async () => {
    let dataSourceSignal: AbortSignal | undefined;
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockImplementation((signal) => {
      dataSourceSignal = signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new RemoteMyChecklistRequestAbortedError());
        });
      });
    });
    const repository = createMyChecklistQueryRepository(dataSource);
    const controller = new AbortController();

    const request = repository.getChecklist(controller.signal);
    const expectation = expect(request).rejects.toBeInstanceOf(
      MyChecklistRequestAbortedError,
    );
    controller.abort();

    await expectation;
    await Promise.resolve();
    expect(dataSourceSignal?.aborted).toBe(true);
  });

  it("마지막 구독 취소 직후 재구독하면 StrictMode의 기존 요청을 공유한다", async () => {
    let resolveChecklist: (value: MyChecklistModel) => void = () => undefined;
    let dataSourceSignal: AbortSignal | undefined;
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockImplementation((signal) => {
      dataSourceSignal = signal;
      return new Promise((resolve) => {
        resolveChecklist = resolve;
      });
    });
    const repository = createMyChecklistQueryRepository(dataSource);
    const controller = new AbortController();

    const firstRequest = repository.getChecklist(controller.signal);
    const firstExpectation = expect(firstRequest).rejects.toBeInstanceOf(
      MyChecklistRequestAbortedError,
    );
    controller.abort();
    const secondRequest = repository.getChecklist();
    resolveChecklist(checklist);

    await firstExpectation;
    await expect(secondRequest).resolves.toBe(checklist);
    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
    expect(dataSourceSignal?.aborted).toBe(false);
  });

  it("무효화 후에는 같은 사용자도 새로 조회한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockResolvedValue(checklist);
    const repository = createMyChecklistQueryRepository(dataSource);
    await repository.getChecklist();
    repository.invalidate();
    await repository.getChecklist();

    expect(dataSource.getChecklist).toHaveBeenCalledTimes(2);
  });

  it("체크리스트 없음 응답을 빈 체크리스트로 변환해 캐시한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockRejectedValue(
      new RemoteMyChecklistApiError(303, 404),
    );
    const repository = createMyChecklistQueryRepository(dataSource);
    await expect(repository.getChecklist()).resolves.toEqual({
      items: [],
    });
    await expect(repository.getChecklist()).resolves.toEqual({
      items: [],
    });
    expect(dataSource.getChecklist).toHaveBeenCalledOnce();
  });

  it("401을 공통 인증 만료 오류로 변환한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockRejectedValue(
      new RemoteMyChecklistApiError(0, 401),
    );
    const repository = createMyChecklistQueryRepository(dataSource);

    await expect(repository.getChecklist()).rejects.toBeInstanceOf(
      MyChecklistAuthenticationRequiredError,
    );
  });

  it("그 외 오류를 공통 조회 실패로 변환한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.getChecklist).mockRejectedValue(
      new RemoteMyChecklistNetworkError(),
    );
    const repository = createMyChecklistQueryRepository(dataSource);

    await expect(repository.getChecklist()).rejects.toBeInstanceOf(
      MyChecklistLoadError,
    );
  });
});
