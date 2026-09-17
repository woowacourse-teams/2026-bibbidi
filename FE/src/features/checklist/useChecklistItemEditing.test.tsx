import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChecklistAudience } from "./model/checklistQuery";
import {
  ChecklistItemChangeError,
  MyChecklistCommandRepository,
} from "./repository/myChecklistCommandRepository";
import { MyChecklistAuthenticationRequiredError } from "./repository/myChecklistQueryRepository";
import { useChecklistItemEditing } from "./useChecklistItemEditing";

const analyticsMocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("../../infrastructure/analytics", () => ({
  analytics: { initialize: vi.fn(), track: analyticsMocks.track },
}));

beforeEach(() => {
  analyticsMocks.track.mockReset();
});

function createDeferred() {
  let reject: (reason?: unknown) => void = () => undefined;
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });

  return { promise, reject, resolve };
}

function createRepository(
  changeItemTitle: MyChecklistCommandRepository["changeItemTitle"],
): MyChecklistCommandRepository {
  return {
    changeAppointmentCompletion: vi.fn(),
    changeItemCategory: vi.fn(),
    changeItemStatus: vi.fn(),
    changeItemTitle,
    createCustomItem: vi.fn(),
    ensureChecklist: vi.fn(),
    hasRemainingAppointments: vi.fn(),
    createAppointment: vi.fn(),
    deleteAppointment: vi.fn(),
    reconcileMissingChecklist: vi.fn(),
    updateAppointment: vi.fn(),
  };
}

describe("useChecklistItemEditing 요청 세대", () => {
  it("이전 요청의 늦은 성공이 새 요청 상태를 변경하거나 성공으로 반환되지 않는다", async () => {
    const firstRequest = createDeferred();
    const secondRequest = createDeferred();
    const repository = createRepository(
      vi
        .fn()
        .mockReturnValueOnce(firstRequest.promise)
        .mockReturnValueOnce(secondRequest.promise),
    );
    const refreshAuth = vi.fn();
    const { result, rerender } = renderHook(
      ({ audience }: { audience: ChecklistAudience }) =>
        useChecklistItemEditing(repository, refreshAuth, audience),
      { initialProps: { audience: "authenticated" as ChecklistAudience } },
    );
    let firstResult: Promise<boolean> = Promise.resolve(false);
    let secondResult: Promise<boolean> = Promise.resolve(false);

    act(() => {
      firstResult = result.current.changeTitle(500, "첫 번째 제목");
    });
    rerender({ audience: "guest" });
    await act(async () => Promise.resolve());
    rerender({ audience: "authenticated" });
    act(() => {
      secondResult = result.current.changeTitle(501, "두 번째 제목");
    });

    await act(async () => firstRequest.resolve());

    await expect(firstResult).resolves.toBe(false);
    expect(analyticsMocks.track).not.toHaveBeenCalled();
    expect(result.current.changeFeedback).toEqual({
      itemId: 501,
      kind: "title",
      status: "pending",
    });

    await act(async () => secondRequest.resolve());
    await expect(secondResult).resolves.toBe(true);
    expect(result.current.changeFeedback).toEqual({ status: "idle" });
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
  });

  it("이전 요청의 늦은 인증 오류가 새 요청 상태나 인증 갱신에 영향을 주지 않는다", async () => {
    const firstRequest = createDeferred();
    const secondRequest = createDeferred();
    const repository = createRepository(
      vi
        .fn()
        .mockReturnValueOnce(firstRequest.promise)
        .mockReturnValueOnce(secondRequest.promise),
    );
    const refreshAuth = vi.fn();
    const { result, rerender } = renderHook(
      ({ audience }: { audience: ChecklistAudience }) =>
        useChecklistItemEditing(repository, refreshAuth, audience),
      { initialProps: { audience: "authenticated" as ChecklistAudience } },
    );
    let firstResult: Promise<boolean> = Promise.resolve(false);

    act(() => {
      firstResult = result.current.changeTitle(500, "첫 번째 제목");
    });
    rerender({ audience: "guest" });
    await act(async () => Promise.resolve());
    rerender({ audience: "authenticated" });
    act(() => {
      void result.current.changeTitle(501, "두 번째 제목");
    });

    await act(async () =>
      firstRequest.reject(new MyChecklistAuthenticationRequiredError()),
    );

    await expect(firstResult).resolves.toBe(false);
    expect(refreshAuth).not.toHaveBeenCalled();
    expect(result.current.changeFeedback).toEqual({
      itemId: 501,
      kind: "title",
      status: "pending",
    });

    await act(async () => secondRequest.resolve());
  });
});

describe("useChecklistItemEditing 성공 이벤트", () => {
  it("제목과 카테고리의 로컬 반영 성공 뒤에만 각각 한 번 전송한다", async () => {
    const repository = createRepository(vi.fn().mockResolvedValue(undefined));
    vi.mocked(repository.changeItemCategory).mockResolvedValue();
    const { result } = renderHook(() =>
      useChecklistItemEditing(repository, vi.fn(), "authenticated"),
    );

    let titleRequest!: Promise<boolean>;
    act(() => {
      titleRequest = result.current.changeTitle(500, "전송하면 안 되는 제목");
    });
    expect(analyticsMocks.track).not.toHaveBeenCalled();
    await act(async () => expect(titleRequest).resolves.toBe(true));
    expect(analyticsMocks.track).toHaveBeenLastCalledWith({
      name: "checklist_task_title_update",
      parameters: { source: "checklist" },
    });

    await act(async () => {
      await expect(result.current.changeCategory(500, "20")).resolves.toBe(
        true,
      );
    });
    expect(analyticsMocks.track).toHaveBeenCalledTimes(2);
    expect(analyticsMocks.track).toHaveBeenLastCalledWith({
      name: "checklist_task_category_update",
      parameters: { category_id: "20" },
    });
  });
});

describe("useChecklistItemEditing 상태 변경", () => {
  it.each(["prev", "continue"] as const)(
    "%s 선택은 남은 일정 조회 없이 바로 상태를 변경한다",
    async (status) => {
      const repository = createRepository(vi.fn());
      vi.mocked(repository.changeItemStatus).mockResolvedValue();
      const { result } = renderHook(() =>
        useChecklistItemEditing(
          repository,
          vi.fn(),
          "authenticated",
          undefined,
          undefined,
          "10",
        ),
      );

      await act(async () => {
        await expect(
          result.current.requestStatusChange(500, status),
        ).resolves.toBe("changed");
      });

      expect(repository.hasRemainingAppointments).not.toHaveBeenCalled();
      expect(repository.changeItemStatus).toHaveBeenCalledWith(
        500,
        status,
        expect.any(AbortSignal),
      );
    },
  );

  it("done에 남은 일정이 없으면 조회 후 바로 완료한다", async () => {
    const repository = createRepository(vi.fn());
    vi.mocked(repository.hasRemainingAppointments).mockResolvedValue(false);
    vi.mocked(repository.changeItemStatus).mockResolvedValue();
    const { result } = renderHook(() =>
      useChecklistItemEditing(
        repository,
        vi.fn(),
        "authenticated",
        undefined,
        undefined,
        "10",
      ),
    );

    await act(async () => {
      await expect(
        result.current.requestStatusChange(500, "done"),
      ).resolves.toBe("changed");
    });

    expect(repository.hasRemainingAppointments).toHaveBeenCalledOnce();
    expect(repository.changeItemStatus).toHaveBeenCalledWith(
      500,
      "done",
      expect.any(AbortSignal),
    );
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "checklist_task_complete",
      parameters: { action: "complete", category_id: "10" },
    });
  });

  it("done에 남은 일정이 있으면 확인 뒤에만 완료한다", async () => {
    const repository = createRepository(vi.fn());
    vi.mocked(repository.hasRemainingAppointments).mockResolvedValue(true);
    vi.mocked(repository.changeItemStatus).mockResolvedValue();
    const { result } = renderHook(() =>
      useChecklistItemEditing(
        repository,
        vi.fn(),
        "authenticated",
        undefined,
        undefined,
        "10",
      ),
    );

    await act(async () => {
      await expect(
        result.current.requestStatusChange(500, "done"),
      ).resolves.toBe("confirmation-required");
    });
    expect(result.current.statusConfirmation).toEqual({
      itemId: 500,
      status: "done",
    });
    expect(repository.changeItemStatus).not.toHaveBeenCalled();

    await act(async () => {
      await expect(result.current.confirmStatusChange(500)).resolves.toBe(true);
    });
    expect(repository.changeItemStatus).toHaveBeenCalledWith(
      500,
      "done",
      expect.any(AbortSignal),
    );
    expect(result.current.statusConfirmation).toBeNull();
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
  });

  it("남은 일정 완료 확인을 취소하면 상태 PUT을 호출하지 않는다", async () => {
    const repository = createRepository(vi.fn());
    vi.mocked(repository.hasRemainingAppointments).mockResolvedValue(true);
    const { result } = renderHook(() =>
      useChecklistItemEditing(repository, vi.fn(), "authenticated"),
    );

    await act(async () => {
      await result.current.requestStatusChange(500, "done");
    });
    act(() => result.current.cancelStatusChange(500));

    expect(result.current.statusConfirmation).toBeNull();
    expect(repository.changeItemStatus).not.toHaveBeenCalled();
    await expect(result.current.confirmStatusChange(500)).resolves.toBe(false);
  });

  it("남은 일정 조회 실패 시 PUT을 호출하지 않고 접근 가능한 오류 상태를 제공한다", async () => {
    const repository = createRepository(vi.fn());
    vi.mocked(repository.hasRemainingAppointments).mockRejectedValue(
      new Error("failed"),
    );
    const { result } = renderHook(() =>
      useChecklistItemEditing(repository, vi.fn(), "authenticated"),
    );

    await act(async () => {
      await expect(
        result.current.requestStatusChange(500, "done"),
      ).resolves.toBe("failed");
    });

    expect(repository.changeItemStatus).not.toHaveBeenCalled();
    expect(result.current.changeFeedback).toMatchObject({
      itemId: 500,
      kind: "status",
      status: "error",
    });
  });

  it("상태 흐름의 인증 오류를 refreshAuth에 연결한다", async () => {
    const repository = createRepository(vi.fn());
    vi.mocked(repository.hasRemainingAppointments).mockRejectedValue(
      new MyChecklistAuthenticationRequiredError(),
    );
    const refreshAuth = vi.fn();
    const { result } = renderHook(() =>
      useChecklistItemEditing(repository, refreshAuth, "authenticated"),
    );

    await act(async () => {
      await result.current.requestStatusChange(500, "done");
    });

    expect(refreshAuth).toHaveBeenCalledOnce();
    expect(repository.changeItemStatus).not.toHaveBeenCalled();
    expect(result.current.changeFeedback).toMatchObject({
      itemId: 500,
      kind: "status",
      status: "error",
    });
  });

  it("진행 중인 상태 요청이 있으면 중복 요청을 막는다", async () => {
    const deferred = createDeferred();
    const repository = createRepository(vi.fn());
    vi.mocked(repository.hasRemainingAppointments).mockReturnValue(
      deferred.promise.then(() => false),
    );
    vi.mocked(repository.changeItemStatus).mockResolvedValue();
    const { result } = renderHook(() =>
      useChecklistItemEditing(repository, vi.fn(), "authenticated"),
    );
    let firstRequest: Promise<string> = Promise.resolve("failed");

    act(() => {
      firstRequest = result.current.requestStatusChange(500, "done");
    });
    await act(async () => {
      await expect(
        result.current.requestStatusChange(500, "continue"),
      ).resolves.toBe("failed");
    });
    expect(repository.changeItemStatus).not.toHaveBeenCalled();

    await act(async () => deferred.resolve());
    await expect(firstRequest).resolves.toBe("changed");
    expect(repository.changeItemStatus).toHaveBeenCalledOnce();
  });

  it("PUT 성공 후 재조회만 실패하면 확인 상태를 닫아 완료 PUT 재전송을 막는다", async () => {
    const repository = createRepository(vi.fn());
    vi.mocked(repository.hasRemainingAppointments).mockResolvedValue(true);
    vi.mocked(repository.changeItemStatus).mockRejectedValue(
      new ChecklistItemChangeError(
        "refresh-failed",
        "상태는 변경됐지만 최신 체크리스트를 불러오지 못했습니다. 다시 조회해주세요.",
      ),
    );
    const onRefreshFailed = vi.fn();
    const { result } = renderHook(() =>
      useChecklistItemEditing(
        repository,
        vi.fn(),
        "authenticated",
        500,
        onRefreshFailed,
      ),
    );

    await act(async () => {
      await result.current.requestStatusChange(500, "done");
    });
    await act(async () => {
      await expect(result.current.confirmStatusChange(500)).resolves.toBe(
        false,
      );
    });

    expect(result.current.statusConfirmation).toBeNull();
    expect(result.current.changeFeedback).toMatchObject({
      itemId: 500,
      kind: "status",
      status: "error",
    });
    expect(repository.changeItemStatus).toHaveBeenCalledWith(
      500,
      "done",
      expect.any(AbortSignal),
    );
    expect(onRefreshFailed).toHaveBeenCalledWith(
      "상태는 변경됐지만 최신 체크리스트를 불러오지 못했습니다. 다시 조회해주세요.",
    );
    await expect(result.current.confirmStatusChange(500)).resolves.toBe(false);
    expect(repository.changeItemStatus).toHaveBeenCalledOnce();
  });

  it("선택 항목이 바뀌면 이전 상태 조회를 취소하고 늦은 확인 응답을 무시한다", async () => {
    let resolveRemaining: (value: boolean) => void = () => undefined;
    let requestSignal: AbortSignal | undefined;
    const repository = createRepository(vi.fn());
    vi.mocked(repository.hasRemainingAppointments).mockImplementation(
      (_itemId, signal) => {
        requestSignal = signal;
        return new Promise<boolean>((resolve) => {
          resolveRemaining = resolve;
        });
      },
    );
    const { result, rerender } = renderHook(
      ({ activeItemId }: { activeItemId: number | null }) =>
        useChecklistItemEditing(
          repository,
          vi.fn(),
          "authenticated",
          activeItemId,
        ),
      { initialProps: { activeItemId: 500 } },
    );
    let statusRequest = Promise.resolve<
      "changed" | "confirmation-required" | "failed"
    >("failed");

    act(() => {
      statusRequest = result.current.requestStatusChange(500, "done");
    });
    rerender({ activeItemId: 501 });

    expect(requestSignal?.aborted).toBe(true);
    await act(async () => resolveRemaining(true));
    await expect(statusRequest).resolves.toBe("failed");
    expect(result.current.statusConfirmation).toBeNull();
    expect(repository.changeItemStatus).not.toHaveBeenCalled();
  });
});
