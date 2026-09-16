import { useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ChecklistAppointmentCreationController,
  ChecklistAppointmentCreationInput,
  useChecklistAppointmentCreation,
} from "./useChecklistAppointmentCreation";

let controller: ChecklistAppointmentCreationController;

function Harness({
  checklistItemId = 500,
  isAuthenticated = true,
  onSubmit,
  sessionIdentity = "authenticated:bibbidi",
}: {
  checklistItemId?: number | null;
  isAuthenticated?: boolean;
  onSubmit?: (
    input: ChecklistAppointmentCreationInput,
  ) => Promise<boolean | void> | boolean | void;
  sessionIdentity?: string;
}) {
  const nextController = useChecklistAppointmentCreation({
    checklistItemId,
    isAuthenticated,
    onSubmit,
    sessionIdentity,
  });

  useEffect(() => {
    controller = nextController;
  }, [nextController]);

  return null;
}

function withController(action: () => void) {
  act(action);
}

async function submit() {
  let result: Awaited<ReturnType<typeof controller.submit>> = null;
  await act(async () => {
    result = await controller.submit();
  });
  return result;
}

describe("useChecklistAppointmentCreation", () => {
  it("필수값, 길이, 유효한 날짜와 시간 순서를 검증하고 첫 오류를 반환한다", async () => {
    render(<Harness onSubmit={vi.fn()} />);
    withController(controller.open);

    expect(await submit()).toBe("title");
    expect(controller.errors).toEqual({
      date: "날짜를 선택해 주세요.",
      title: "일정 제목을 입력해 주세요.",
    });

    withController(() => {
      controller.changeTitle("가".repeat(256));
      controller.changeDate("2026-02-30");
      controller.changeStartTime("18:30");
      controller.changeEndTime("17:00");
      controller.changePlace("나".repeat(256));
    });

    expect(await submit()).toBe("title");
    expect(controller.errors).toEqual({
      date: "날짜를 YYYY-MM-DD 형식의 유효한 날짜로 입력해 주세요.",
      endTime: "종료 시간은 시작 시간보다 빠를 수 없어요.",
      place: "장소는 255자 이하로 입력해 주세요.",
      title: "일정 제목은 255자 이하로 입력해 주세요.",
    });
  });

  it("선택 시간은 날짜와 결합한 로컬 문자열로 만들고 공백 선택값은 생략한다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<Harness onSubmit={onSubmit} />);
    withController(() => {
      controller.open();
      controller.changeTitle(" 웨딩홀 상담 ");
      controller.changeDate("2028-02-29");
      controller.changeStartTime("09:05");
      controller.changeMemo("   ");
    });

    expect(await submit()).toBeNull();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({
      checklistItemId: 500,
      date: "2028-02-29",
      endTime: undefined,
      memo: undefined,
      place: undefined,
      startTime: "2028-02-29T09:05:00",
      title: "웨딩홀 상담",
    });
    expect(controller.isOpen).toBe(false);
    expect(controller.draft.title).toBe("");
  });

  it("제출 중에는 취소와 중복 제출을 막고 View에 제출 상태를 제공한다", async () => {
    let resolveSubmission: ((result: boolean) => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmission = resolve;
        }),
    );
    render(<Harness onSubmit={onSubmit} />);
    withController(() => {
      controller.open();
      controller.changeTitle("상담");
      controller.changeDate("2026-09-01");
    });

    let firstSubmission: Promise<unknown> | undefined;
    let duplicateSubmission: Promise<unknown> | undefined;
    act(() => {
      firstSubmission = controller.submit();
      duplicateSubmission = controller.submit();
    });
    await duplicateSubmission;
    await waitFor(() =>
      expect(controller.submissionState.status).toBe("submitting"),
    );

    withController(controller.cancel);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(controller.isOpen).toBe(true);

    await act(async () => {
      resolveSubmission?.(true);
      await firstSubmission;
    });
    expect(controller.isOpen).toBe(false);
  });

  it("취소 후 재열기와 인증 대상·체크리스트 항목 변경 시 draft를 정리한다", async () => {
    const onSubmit = vi.fn();
    const view = render(<Harness onSubmit={onSubmit} />);
    withController(() => {
      controller.open();
      controller.changeTitle("취소할 일정");
      controller.cancel();
      controller.open();
    });
    expect(controller.draft.title).toBe("");

    withController(() => controller.changeTitle("다른 사용자에게 숨길 draft"));
    view.rerender(
      <Harness
        onSubmit={onSubmit}
        sessionIdentity="authenticated:another-user"
      />,
    );
    expect(controller.isOpen).toBe(false);
    await waitFor(() => expect(controller.draft.title).toBe(""));

    withController(() => {
      controller.open();
      controller.changeTitle("다른 항목에 숨길 draft");
    });
    view.rerender(<Harness checklistItemId={501} onSubmit={onSubmit} />);
    expect(controller.isOpen).toBe(false);
    await waitFor(() => expect(controller.draft.title).toBe(""));

    withController(() => {
      controller.open();
      controller.changeTitle("로그아웃 뒤 숨길 draft");
    });
    view.rerender(
      <Harness
        checklistItemId={501}
        isAuthenticated={false}
        onSubmit={onSubmit}
      />,
    );
    expect(controller.isOpen).toBe(false);
    await waitFor(() => expect(controller.draft.title).toBe(""));
  });

  it("인증되지 않았거나 선택한 서버 항목이 없으면 열기와 제출을 허용하지 않는다", () => {
    const onSubmit = vi.fn();
    const view = render(
      <Harness isAuthenticated={false} onSubmit={onSubmit} />,
    );
    withController(controller.open);
    expect(controller.isOpen).toBe(false);
    expect(controller.canSubmit).toBe(false);

    view.rerender(<Harness checklistItemId={null} onSubmit={onSubmit} />);
    withController(controller.open);
    expect(controller.isOpen).toBe(false);
    expect(controller.canSubmit).toBe(false);
  });

  it("제출 중 unmount되어도 완료 결과로 상태를 다시 노출하지 않는다", async () => {
    let resolveSubmission: (() => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmission = resolve;
        }),
    );
    const view = render(<Harness onSubmit={onSubmit} />);
    withController(() => {
      controller.open();
      controller.changeTitle("상담");
      controller.changeDate("2026-09-01");
    });

    let submission: Promise<unknown> | undefined;
    act(() => {
      submission = controller.submit();
    });
    view.unmount();

    await act(async () => {
      resolveSubmission?.();
      await submission;
    });
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
