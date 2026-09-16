import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChecklistAudience } from "./model/checklistQuery";
import { MyChecklistCommandRepository } from "./repository/myChecklistCommandRepository";
import { MyChecklistAuthenticationRequiredError } from "./repository/myChecklistQueryRepository";
import { useChecklistItemEditing } from "./useChecklistItemEditing";

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
    changeItemTitle,
    ensureChecklist: vi.fn(),
    reconcileMissingChecklist: vi.fn(),
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
    expect(result.current.titleFeedback).toEqual({
      itemId: 501,
      status: "pending",
    });

    await act(async () => secondRequest.resolve());
    await expect(secondResult).resolves.toBe(true);
    expect(result.current.titleFeedback).toEqual({ status: "idle" });
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
    expect(result.current.titleFeedback).toEqual({
      itemId: 501,
      status: "pending",
    });

    await act(async () => secondRequest.resolve());
  });
});
