import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppointmentManagementError } from "./model/appointmentManagement";
import { MyChecklistCommandRepository } from "./repository/myChecklistCommandRepository";
import { useChecklistAppointmentManagement } from "./useChecklistAppointmentManagement";
import { ChecklistAppointmentViewModel } from "./view-model/createChecklistViewModel";

const appointment: ChecklistAppointmentViewModel = {
  date: "2026-09-20",
  dateLabel: "9월 20일",
  dayLabel: "20일",
  endTime: "2026-09-20T11:30:00",
  id: 11,
  isDone: false,
  memo: "견적 확인",
  memoLabel: "견적 확인",
  monthLabel: "9월",
  place: "웨딩홀",
  placeLabel: "웨딩홀",
  startTime: "2026-09-20T10:00:00",
  timeLabel: "오전 10시–오전 11시 30분",
  title: "웨딩홀 상담",
};

function createRepository(): MyChecklistCommandRepository {
  return {
    changeAppointmentCompletion: vi.fn().mockResolvedValue(undefined),
    changeItemCategory: vi.fn(),
    changeItemStatus: vi.fn(),
    changeItemTitle: vi.fn(),
    createAppointment: vi.fn(),
    createCustomItem: vi.fn(),
    deleteAppointment: vi.fn().mockResolvedValue(undefined),
    ensureChecklist: vi.fn(),
    hasRemainingAppointments: vi.fn(),
    reconcileMissingChecklist: vi.fn(),
    updateAppointment: vi.fn().mockResolvedValue(undefined),
  };
}

function createDeferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useChecklistAppointmentManagement", () => {
  let repository: MyChecklistCommandRepository;
  const refreshAuth = vi.fn();

  beforeEach(() => {
    repository = createRepository();
    refreshAuth.mockReset();
  });

  it("기존 일정 전체 값을 수정 draft에 채우고 공용 포맷으로 저장한다", async () => {
    const deferred = createDeferred();
    vi.mocked(repository.updateAppointment).mockReturnValue(deferred.promise);
    const { result } = renderHook(() =>
      useChecklistAppointmentManagement({
        audience: "authenticated",
        checklistItemId: 500,
        commandRepository: repository,
        refreshAuth,
        sessionIdentity: "user-a",
      }),
    );

    act(() => result.current.startEditing(appointment));
    expect(result.current.editing.draft).toEqual({
      date: "2026-09-20",
      endTime: "11:30",
      memo: "견적 확인",
      place: "웨딩홀",
      startTime: "10:00",
      title: "웨딩홀 상담",
    });

    act(() => result.current.editing.changeTitle(" 수정된 상담 "));
    let firstSubmit: Promise<unknown> = Promise.resolve();
    await act(async () => {
      firstSubmit = result.current.editing.submit();
      await Promise.resolve();
    });
    expect(result.current.editing.submissionState.status).toBe("submitting");
    expect(repository.updateAppointment).toHaveBeenCalledWith(
      11,
      500,
      {
        date: "2026-09-20",
        endTime: "2026-09-20T11:30:00",
        memo: "견적 확인",
        place: "웨딩홀",
        startTime: "2026-09-20T10:00:00",
        title: "수정된 상담",
      },
      expect.any(AbortSignal),
    );

    await act(async () => {
      await result.current.editing.submit();
    });
    expect(repository.updateAppointment).toHaveBeenCalledOnce();

    await act(async () => {
      deferred.resolve();
      await firstSubmit;
    });
    expect(result.current.editing.isOpen).toBe(false);
  });

  it("완료 상태 변경 중 중복 요청을 막고 실패 상태에서 재시도한다", async () => {
    const deferred = createDeferred();
    vi.mocked(repository.changeAppointmentCompletion)
      .mockReturnValueOnce(deferred.promise)
      .mockRejectedValueOnce(
        new AppointmentManagementError(
          "unknown",
          "일정 상태를 변경하지 못했어요.",
        ),
      )
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() =>
      useChecklistAppointmentManagement({
        audience: "authenticated",
        checklistItemId: 500,
        commandRepository: repository,
        refreshAuth,
      }),
    );

    let firstChange: Promise<void> = Promise.resolve();
    act(() => {
      firstChange = result.current.changeCompletion(11, true);
      void result.current.changeCompletion(11, true);
    });
    expect(repository.changeAppointmentCompletion).toHaveBeenCalledOnce();
    expect(result.current.operationFeedback.status).toBe("pending");
    await act(async () => {
      deferred.resolve();
      await firstChange;
    });

    await act(async () => result.current.changeCompletion(11, false));
    expect(result.current.operationFeedback).toMatchObject({
      appointmentId: 11,
      errorMessage: "일정 상태를 변경하지 못했어요.",
      operation: "completion",
      status: "error",
    });
    await act(async () => result.current.changeCompletion(11, false));
    expect(repository.changeAppointmentCompletion).toHaveBeenCalledTimes(3);
    expect(result.current.operationFeedback.status).toBe("idle");
  });

  it("삭제는 확인 뒤에만 실행하고 실패 시 다이얼로그 상태를 유지한다", async () => {
    vi.mocked(repository.deleteAppointment)
      .mockRejectedValueOnce(
        new AppointmentManagementError("unknown", "일정을 삭제하지 못했어요."),
      )
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() =>
      useChecklistAppointmentManagement({
        audience: "authenticated",
        checklistItemId: 500,
        commandRepository: repository,
        refreshAuth,
      }),
    );

    act(() => result.current.requestDelete(appointment.id));
    expect(repository.deleteAppointment).not.toHaveBeenCalled();
    expect(result.current.deletionConfirmation).toEqual({
      appointmentId: 11,
    });

    await act(async () => result.current.confirmDelete());
    expect(result.current.deletionConfirmation).not.toBeNull();
    expect(result.current.operationFeedback).toMatchObject({
      operation: "delete",
      status: "error",
    });

    await act(async () => result.current.confirmDelete());
    expect(repository.deleteAppointment).toHaveBeenCalledTimes(2);
    expect(result.current.deletionConfirmation).toBeNull();
  });

  it("인증 대상이나 선택 항목이 바뀌면 진행 중 요청을 취소하고 UI 상태를 정리한다", async () => {
    let requestSignal: AbortSignal | undefined;
    vi.mocked(repository.changeAppointmentCompletion).mockImplementation(
      (_appointmentId, _isDone, signal) => {
        requestSignal = signal;
        return new Promise(() => undefined);
      },
    );
    const { result, rerender } = renderHook(
      ({ checklistItemId }) =>
        useChecklistAppointmentManagement({
          audience: "authenticated",
          checklistItemId,
          commandRepository: repository,
          refreshAuth,
          sessionIdentity: "user-a",
        }),
      { initialProps: { checklistItemId: 500 } },
    );

    act(() => {
      result.current.toggleMenu(11);
      void result.current.changeCompletion(11, true);
    });
    rerender({ checklistItemId: 501 });
    await act(async () => Promise.resolve());

    expect(requestSignal?.aborted).toBe(true);
    expect(result.current.openMenuAppointmentId).toBeNull();
    expect(result.current.operationFeedback.status).toBe("idle");
  });
});
