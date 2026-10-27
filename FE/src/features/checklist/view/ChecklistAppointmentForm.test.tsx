import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dateLabel, localToday } from "../../../shared/date/calendarDate";
import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../../shared/responsive";
import { installMatchMedia } from "../../../test/matchMedia";
import { useChecklistAppointmentCreation } from "../useChecklistAppointmentCreation";
import type { ChecklistAppointmentCreationInput } from "../useChecklistAppointmentCreation";
import { ChecklistAppointmentForm } from "./ChecklistAppointmentForm";

vi.mock("../../../infrastructure/analytics", () => ({
  analytics: { track: vi.fn() },
}));
vi.mock("../../../infrastructure/error-tracking", () => ({
  addErrorAction: vi.fn(),
  reportHandledError: vi.fn(),
}));

afterEach(() => vi.unstubAllGlobals());

function Harness({
  onSubmit,
}: {
  onSubmit: (
    input: ChecklistAppointmentCreationInput,
  ) => Promise<boolean | void>;
}) {
  const controller = useChecklistAppointmentCreation({
    checklistItemId: 10,
    isAuthenticated: true,
    onSubmit,
  });
  return (
    <>
      <button type="button" onClick={() => controller.open()}>
        일정 추가 열기
      </button>
      {controller.isOpen && (
        <ChecklistAppointmentForm
          controller={controller}
          taskTitle="웨딩홀 계약"
        />
      )}
    </>
  );
}

async function chooseTime(label: string, hour: string, minute: string) {
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`^${label} `) }),
  );
  const panel = screen.getByRole("dialog", { name: `${label} 선택` });
  fireEvent.click(
    within(within(panel).getByRole("listbox", { name: "시" })).getByRole(
      "option",
      { name: hour },
    ),
  );
  fireEvent.click(
    within(within(panel).getByRole("listbox", { name: "분" })).getByRole(
      "option",
      { name: minute },
    ),
  );
  fireEvent.click(within(panel).getByRole("button", { name: "확인" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: `${label} 선택` })).toBeNull(),
  );
}

describe.each([false, true])(
  "일정 폼의 날짜·시간 선택 (모바일=%s)",
  (mobile) => {
    it("날짜 필수와 시간 순서 오류의 초점을 유지하고 1분 값을 기존 요청 형식으로 저장한다", async () => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
      const onSubmit = vi.fn().mockResolvedValue(true);
      render(<Harness onSubmit={onSubmit} />);
      fireEvent.click(screen.getByRole("button", { name: "일정 추가 열기" }));
      fireEvent.change(screen.getByLabelText(/제목/), {
        target: { value: "방문 상담" },
      });
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      const dateTrigger = screen.getByRole("button", {
        name: "날짜 날짜 선택",
        description: "필수 항목입니다. 날짜를 선택해 주세요.",
      });
      await waitFor(() => expect(document.activeElement).toBe(dateTrigger));
      expect(screen.getByRole("alert").textContent).toBe(
        "날짜를 선택해 주세요.",
      );
      fireEvent.click(dateTrigger);
      const panel = screen.getByRole("dialog", { name: "날짜 선택" });
      const today = localToday();
      fireEvent.click(
        within(panel).getByRole("gridcell", { name: dateLabel(today) }),
      );
      fireEvent.click(within(panel).getByRole("button", { name: "확인" }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "날짜 선택" })).toBeNull(),
      );
      expect(screen.queryByText("날짜를 선택해 주세요.")).toBeNull();
      expect(
        screen.getByRole("button", {
          name: `날짜 ${today}`,
          description: "필수 항목입니다.",
        }),
      ).toBeTruthy();
      await chooseTime("시작 시간", "9", "13");
      await chooseTime("종료 시간", "8", "45");
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: "종료 시간 08:45" }),
        ),
      );
      expect(
        screen.getByText("종료 시간은 시작 시간보다 빠를 수 없어요."),
      ).toBeTruthy();
      expect(onSubmit).not.toHaveBeenCalled();
      await chooseTime("종료 시간", "10", "17");
      expect(
        screen.queryByText("종료 시간은 시작 시간보다 빠를 수 없어요."),
      ).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
      expect(onSubmit.mock.calls[0][0]).toMatchObject({
        checklistItemId: 10,
        title: "방문 상담",
        date: today,
        startTime: `${today}T09:13:00`,
        endTime: `${today}T10:17:00`,
      });
    });

    it("선택 패널의 Escape와 Tab은 뒤의 일정 작성 폼을 닫지 않는다", async () => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
      render(<Harness onSubmit={vi.fn().mockResolvedValue(true)} />);
      fireEvent.click(screen.getByRole("button", { name: "일정 추가 열기" }));
      const title = screen.getByLabelText(/제목/);
      fireEvent.change(title, { target: { value: "작성 중인 제목" } });
      const trigger = screen.getByRole("button", {
        name: "시작 시간 시간 선택",
      });
      trigger.focus();
      fireEvent.click(trigger);
      const panel = screen.getByRole("dialog", { name: "시작 시간 선택" });
      const confirm = within(panel).getByRole("button", { name: "확인" });
      if (mobile) {
        confirm.focus();
        fireEvent.keyDown(confirm, { key: "Tab" });
        expect(panel.contains(document.activeElement)).toBe(true);
      }
      fireEvent.keyDown(within(panel).getByRole("listbox", { name: "시" }), {
        key: "Escape",
      });
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "시작 시간 선택" }),
        ).toBeNull(),
      );
      expect(document.activeElement).toBe(trigger);
      expect((screen.getByLabelText(/제목/) as HTMLInputElement).value).toBe(
        "작성 중인 제목",
      );
    });
  },
);
