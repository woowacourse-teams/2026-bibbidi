import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChecklistAudience } from "./model/checklistQuery";
import {
  CustomChecklistItemCreationError,
  MyChecklistCommandRepository,
} from "./repository/myChecklistCommandRepository";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistRequestAbortedError,
} from "./repository/myChecklistQueryRepository";
import { useChecklistTaskCreationCommand } from "./useChecklistTaskCreationCommand";

const analyticsMocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("../../infrastructure/analytics", () => ({
  analytics: { initialize: vi.fn(), track: analyticsMocks.track },
}));

beforeEach(() => {
  analyticsMocks.track.mockReset();
});

function createRepository(
  createCustomItem: MyChecklistCommandRepository["createCustomItem"] = vi
    .fn()
    .mockResolvedValue(undefined),
): MyChecklistCommandRepository {
  return {
    changeItemCategory: vi.fn(),
    changeItemStatus: vi.fn(),
    changeItemTitle: vi.fn(),
    createCustomItem,
    ensureChecklist: vi.fn(),
    hasRemainingAppointments: vi.fn(),
    createAppointment: vi.fn(),
    reconcileMissingChecklist: vi.fn(),
  };
}

function createDeferred() {
  let reject: (reason?: unknown) => void = () => undefined;
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });

  return { promise, reject, resolve };
}

const input = { categoryId: "2", title: "청첩장 문구 정하기" };

describe("useChecklistTaskCreationCommand", () => {
  it("제출 상태와 AbortSignal을 관리하고 진행 중 중복 요청을 막는다", async () => {
    const deferred = createDeferred();
    const createCustomItem = vi.fn().mockReturnValue(deferred.promise);
    const repository = createRepository(createCustomItem);
    const { result } = renderHook(() =>
      useChecklistTaskCreationCommand(repository, vi.fn(), "authenticated"),
    );

    let firstRequest!: Promise<boolean>;
    await act(async () => {
      firstRequest = result.current.submit(input);
    });

    expect(result.current.submissionState).toEqual({ status: "submitting" });
    expect(createCustomItem).toHaveBeenCalledWith(
      input.title,
      input.categoryId,
      expect.any(AbortSignal),
    );
    await expect(result.current.submit(input)).resolves.toBe(false);
    expect(createCustomItem).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve();
      await expect(firstRequest).resolves.toBe(true);
    });
    expect(result.current.submissionState).toEqual({ status: "idle" });
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "checklist_task_create",
      parameters: { category_id: "2", source: "checklist" },
    });
  });

  it("실패 메시지를 표시하고 재시도 시작 시 이전 오류를 지운다", async () => {
    const retry = createDeferred();
    const createCustomItem = vi
      .fn()
      .mockRejectedValueOnce(
        new CustomChecklistItemCreationError(
          "category-not-found",
          "카테고리를 찾을 수 없습니다.",
        ),
      )
      .mockReturnValueOnce(retry.promise);
    const repository = createRepository(createCustomItem);
    const { result } = renderHook(() =>
      useChecklistTaskCreationCommand(repository, vi.fn(), "authenticated"),
    );

    await act(async () => {
      await expect(result.current.submit(input)).resolves.toBe(false);
    });
    expect(result.current.submissionState).toEqual({
      message: "카테고리를 찾을 수 없습니다.",
      status: "error",
    });
    expect(analyticsMocks.track).not.toHaveBeenCalled();

    let retryRequest!: Promise<boolean>;
    await act(async () => {
      retryRequest = result.current.submit(input);
    });
    expect(result.current.submissionState).toEqual({ status: "submitting" });

    await act(async () => {
      retry.resolve();
      await retryRequest;
    });
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
  });

  it("인증 오류를 기존 refreshAuth 흐름에 연결한다", async () => {
    const refreshAuth = vi.fn();
    const repository = createRepository(
      vi.fn().mockRejectedValue(new MyChecklistAuthenticationRequiredError()),
    );
    const { result } = renderHook(() =>
      useChecklistTaskCreationCommand(repository, refreshAuth, "authenticated"),
    );

    await act(async () => {
      await expect(result.current.submit(input)).resolves.toBe(false);
    });

    expect(refreshAuth).toHaveBeenCalledOnce();
    expect(result.current.submissionState).toEqual({
      message: "로그인이 필요합니다.",
      status: "error",
    });
  });

  it("같은 사용자 인증 재확인으로 Repository만 바뀌면 완료된 오류 상태를 유지한다", async () => {
    const firstRepository = createRepository(
      vi.fn().mockRejectedValue(new MyChecklistAuthenticationRequiredError()),
    );
    const secondRepository = createRepository();
    const refreshAuth = vi.fn();
    const { result, rerender } = renderHook(
      ({ repository }: { repository: MyChecklistCommandRepository }) =>
        useChecklistTaskCreationCommand(
          repository,
          refreshAuth,
          "authenticated",
          "authenticated:bibbidi",
        ),
      { initialProps: { repository: firstRepository } },
    );

    await act(async () => {
      await result.current.submit(input);
    });
    rerender({ repository: secondRepository });

    expect(result.current.submissionState).toEqual({
      message: "로그인이 필요합니다.",
      status: "error",
    });
  });

  it("guest 전환 시 요청을 취소하고 늦은 결과를 무시하며 상태를 초기화한다", async () => {
    let requestSignal: AbortSignal | undefined;
    const repository = createRepository(
      vi.fn((_title, _categoryId, signal) => {
        requestSignal = signal;
        return new Promise<void>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new MyChecklistRequestAbortedError());
          });
        });
      }),
    );
    const refreshAuth = vi.fn();
    const { result, rerender } = renderHook(
      ({ audience }: { audience: ChecklistAudience | undefined }) =>
        useChecklistTaskCreationCommand(repository, refreshAuth, audience),
      { initialProps: { audience: "authenticated" as ChecklistAudience } },
    );

    let request!: Promise<boolean>;
    await act(async () => {
      request = result.current.submit(input);
    });
    rerender({ audience: "guest" });

    expect(requestSignal?.aborted).toBe(true);
    await act(async () => {
      await expect(request).resolves.toBe(false);
      await Promise.resolve();
    });
    expect(result.current.submissionState).toEqual({ status: "idle" });
    expect(refreshAuth).not.toHaveBeenCalled();
  });

  it("요청 세대는 유효하지만 인증 context가 바뀌면 idle로 되돌린다", async () => {
    const deferred = createDeferred();
    const repository = createRepository(
      vi.fn().mockReturnValue(deferred.promise),
    );
    const refreshAuth = vi.fn();
    const { result, rerender } = renderHook(
      ({ audience }: { audience: ChecklistAudience | undefined }) =>
        useChecklistTaskCreationCommand(
          repository,
          refreshAuth,
          audience,
          "authenticated:1",
        ),
      {
        initialProps: {
          audience: "authenticated" as ChecklistAudience | undefined,
        },
      },
    );
    let request!: Promise<boolean>;
    await act(async () => {
      request = result.current.submit(input);
    });
    expect(result.current.submissionState).toEqual({ status: "submitting" });

    rerender({ audience: undefined });
    await act(async () => {
      deferred.resolve();
      await expect(request).resolves.toBe(false);
    });

    expect(result.current.submissionState).toEqual({ status: "idle" });
    expect(refreshAuth).not.toHaveBeenCalled();
  });

  it("세션 Repository가 바뀌면 이전 요청을 취소하고 제출 상태를 초기화한다", async () => {
    let requestSignal: AbortSignal | undefined;
    const firstRepository = createRepository(
      vi.fn((_title, _categoryId, signal) => {
        requestSignal = signal;
        return new Promise<void>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new MyChecklistRequestAbortedError());
          });
        });
      }),
    );
    const secondRepository = createRepository();
    const { result, rerender } = renderHook(
      ({ repository }: { repository: MyChecklistCommandRepository }) =>
        useChecklistTaskCreationCommand(repository, vi.fn(), "authenticated"),
      { initialProps: { repository: firstRepository } },
    );
    let request!: Promise<boolean>;
    await act(async () => {
      request = result.current.submit(input);
    });

    rerender({ repository: secondRepository });

    expect(requestSignal?.aborted).toBe(true);
    await act(async () => {
      await expect(request).resolves.toBe(false);
      await Promise.resolve();
    });
    expect(result.current.submissionState).toEqual({ status: "idle" });
  });

  it("unmount 시 진행 중 요청을 취소한다", async () => {
    let requestSignal: AbortSignal | undefined;
    const repository = createRepository(
      vi.fn((_title, _categoryId, signal) => {
        requestSignal = signal;
        return new Promise<void>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new MyChecklistRequestAbortedError());
          });
        });
      }),
    );
    const { result, unmount } = renderHook(() =>
      useChecklistTaskCreationCommand(repository, vi.fn(), "authenticated"),
    );
    let request!: Promise<boolean>;
    await act(async () => {
      request = result.current.submit(input);
    });

    unmount();

    expect(requestSignal?.aborted).toBe(true);
    await expect(request).resolves.toBe(false);
  });
});
