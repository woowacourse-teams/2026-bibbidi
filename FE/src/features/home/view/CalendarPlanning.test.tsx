import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MemoryRouter } from "react-router";

import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../../shared/responsive";
import { installMatchMedia } from "../../../test/matchMedia";
import type { ComponentProps } from "react";
import { CalendarPlanning } from "./CalendarPlanning";

function CalendarPlanningHarness({
  referenceDate,
  schedules = [],
  focusDate,
  focusDateRevision = 0,
  schedulesStatus = "complete",
  onRetry = () => {},
}: Pick<
  ComponentProps<typeof CalendarPlanning>,
  "referenceDate" | "focusDate"
> & {
  schedules?: ComponentProps<typeof CalendarPlanning>["schedules"];
  focusDateRevision?: number;
  schedulesStatus?: "loading" | "error" | "complete";
  onRetry?: () => void;
}) {
  return (
    <MemoryRouter>
      <CalendarPlanning
        referenceDate={referenceDate}
        schedules={schedules}
        focusDate={focusDate}
        focusDateRevision={focusDateRevision}
        checklistStatus={schedulesStatus}
        retryChecklist={onRetry}
        isGuest
        hasTasks={false}
        undated={[]}
        onRequestDate={() => {}}
        recommendations={null}
        dialogs={null}
      />
    </MemoryRouter>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("CalendarPlanning", () => {
  it.each([
    ["0005-01-01", "5년 1월 달력", "5년 1월 1일, 오늘"],
    ["0099-12-31", "99년 12월 달력", "99년 12월 31일, 오늘"],
  ])("%s의 연도를 1900년대로 바꾸지 않는다", (referenceDate, heading, date) => {
    render(<CalendarPlanningHarness referenceDate={referenceDate} />);
    expect(screen.getByRole("table", { name: heading })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: date }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(
      screen.getByRole("table", {
        name: referenceDate.startsWith("0099")
          ? "100년 1월 달력"
          : "5년 2월 달력",
      }),
    ).toBeTruthy();
  });

  it.each([
    ["0001-01-01", "이전 달"],
    ["9999-12-31", "다음 달"],
  ])(
    "%s에서 지원 범위 밖 월 이동과 날짜 선택을 막는다",
    (referenceDate, direction) => {
      render(<CalendarPlanningHarness referenceDate={referenceDate} />);
      const navigation = screen.getByRole("button", {
        name: direction,
      }) as HTMLButtonElement;
      expect(navigation.disabled).toBe(true);
      fireEvent.click(navigation);
      const cells = within(screen.getByRole("table")).getAllByRole("cell");
      expect(cells).toHaveLength(42);
      expect(cells.some((cell) => cell.childElementCount === 0)).toBe(true);
      expect(
        document.querySelector(
          'time[datetime^="0000"], time[datetime^="10000"]',
        ),
      ).toBeNull();
    },
  );

  it.each([false, true])(
    "모바일 여부 %s에서 2200년 일정과 연·월 선택 값을 일치시킨다",
    async (mobile) => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
      render(
        <CalendarPlanningHarness
          referenceDate="2026-10-27"
          focusDate="2200-06-30"
          focusDateRevision={1}
        />,
      );
      const trigger = await screen.findByRole("button", {
        name: "2200년 6월, 연·월 선택",
      });
      fireEvent.click(trigger);
      const picker = screen.getByRole("dialog", { name: "연·월 선택" });
      expect(
        within(picker).getByRole("option", { name: "2200년", selected: true }),
      ).toBeTruthy();
      expect(
        within(picker).getByRole("option", { name: "6월", selected: true }),
      ).toBeTruthy();
      fireEvent.click(within(picker).getByRole("button", { name: "이동" }));
      expect(
        screen.getByRole("region", { name: "2200년 6월 30일 일정" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("table", { name: "2200년 6월 달력" }),
      ).toBeTruthy();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    },
  );

  it("일요일 시작 6주 그리드에 앞뒤 달 날짜와 오늘을 표시한다", () => {
    render(<CalendarPlanningHarness referenceDate="2026-09-16" />);

    const calendar = screen.getByRole("table", { name: "2026년 9월 달력" });
    expect(within(calendar).getAllByRole("columnheader")).toHaveLength(7);
    expect(within(calendar).getAllByRole("cell")).toHaveLength(42);
    expect(within(calendar).getAllByRole("columnheader")[0].textContent).toBe(
      "일",
    );
    expect(screen.getByLabelText("2026년 8월 30일")).toBeTruthy();
    expect(screen.getByLabelText("2026년 10월 10일")).toBeTruthy();

    const today = screen.getByLabelText("2026년 9월 16일, 오늘");
    expect(today.getAttribute("aria-current")).toBe("date");
    expect(today.closest("td")?.className).toContain(
      "monthly-calendar__day--today",
    );
    expect(
      screen.getByLabelText("2026년 8월 30일").closest("td")?.className,
    ).toContain("monthly-calendar__day--outside");
    expect(within(calendar).getAllByRole("button")).toHaveLength(42);
  });

  it("이전 달과 다음 달로 이동하며 오늘 이동 버튼은 표시하지 않는다", () => {
    render(<CalendarPlanningHarness referenceDate="2026-09-16" />);

    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(
      screen.getByRole("table", { name: "2026년 10월 달력" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "이전 달" }));
    fireEvent.click(screen.getByRole("button", { name: "이전 달" }));
    expect(screen.getByRole("table", { name: "2026년 8월 달력" })).toBeTruthy();

    expect(screen.queryByRole("button", { name: "오늘" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(screen.getByRole("table", { name: "2026년 9월 달력" })).toBeTruthy();
  });

  it("저장된 일정을 해당 날짜에 제목과 추가 개수로 표시한다", () => {
    render(
      <CalendarPlanningHarness
        referenceDate="2026-09-16"
        schedules={[
          {
            date: "2026-09-16",
            id: 1,
            title: "웨딩홀 상담",
          },
          {
            date: "2026-09-16",
            id: 2,
            title: "드레스 투어",
          },
          {
            date: "2026-09-16",
            id: 3,
            title: "청첩장 수령",
          },
          {
            date: "2026-10-01",
            id: 4,
            title: "예복 가봉",
          },
        ]}
      />,
    );

    const september16 = screen
      .getByLabelText("2026년 9월 16일, 오늘")
      .closest("td");
    const october1 = screen.getByLabelText("2026년 10월 1일").closest("td");

    expect(september16).not.toBeNull();
    expect(october1).not.toBeNull();
    expect(within(september16!).getByText("웨딩홀 상담")).toBeTruthy();
    expect(within(september16!).queryByText("드레스 투어")).toBeNull();
    expect(within(september16!).getByText("+2개")).toBeTruthy();
    expect(within(september16!).queryByText("청첩장 수령")).toBeNull();
    expect(within(october1!).getByText("예복 가봉")).toBeTruthy();
  });
  it("일정 칩과 선택 날짜 목록에서 상세 모달을 열고 닫는다", () => {
    render(
      <CalendarPlanningHarness
        referenceDate="2026-10-05"
        schedules={[
          {
            id: 1,
            title: "웨딩홀 상담",
            date: "2026-10-08",
            checklistItemId: 42,
            startTime: "2026-10-08T14:00:00",
            endTime: "2026-10-08T15:00:00",
            place: "웨딩홀",
            memo: "계약서 확인",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /14:00/ }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("14:00 – 15:00")).toBeTruthy();
    expect(within(dialog).getByText("웨딩홀")).toBeTruthy();
    expect(within(dialog).getByText("계약서 확인")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "2026년 10월 8일" }));
    const selected = screen.getByRole("region", {
      name: "2026년 10월 8일 일정",
    });
    expect(within(selected).getByText("14:00")).toBeTruthy();
    fireEvent.click(within(selected).getByRole("button"));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("2026년 10월 8일")).toBeTruthy();
    expect(
      within(dialog)
        .getByRole("link", { name: "상세·수정" })
        .getAttribute("href"),
    ).toBe("/checklist?taskId=checklist-item-42");
    fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "2026년 10월 8일" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByLabelText("2026년 10월 5일, 오늘")
        .getAttribute("aria-current"),
    ).toBe("date");
  });
  it("저장 후 같은 날짜라도 다른 달에서 돌아와 선택할 수 있다", async () => {
    const view = render(
      <CalendarPlanningHarness
        referenceDate="2026-10-05"
        focusDate="2026-11-12"
        focusDateRevision={1}
      />,
    );
    expect(
      await screen.findByRole("table", { name: "2026년 11월 달력" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    view.rerender(
      <CalendarPlanningHarness
        referenceDate="2026-10-05"
        focusDate="2026-11-12"
        focusDateRevision={2}
      />,
    );
    expect(
      await screen.findByRole("table", { name: "2026년 11월 달력" }),
    ).toBeTruthy();
  });
  it.each([
    ["2026-01-31", "다음 달", "2026년 2월 28일", "2026년 2월 28일 일정"],
    ["2028-01-31", "다음 달", "2028년 2월 29일", "2028년 2월 29일 일정"],
    ["2026-12-15", "다음 달", "2027년 1월 15일", "2027년 1월 15일 일정"],
    ["2026-01-15", "이전 달", "2025년 12월 15일", "2025년 12월 15일 일정"],
  ])(
    "%s에서 월을 이동하면 해당 달의 같은 일자 또는 말일을 선택한다",
    (referenceDate, direction, dateLabel, sectionLabel) => {
      render(<CalendarPlanningHarness referenceDate={referenceDate} />);
      fireEvent.click(screen.getByRole("button", { name: direction }));
      expect(
        screen
          .getByRole("button", { name: dateLabel })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        within(screen.getByRole("region", { name: sectionLabel })).getByText(
          "이 날짜에 등록된 일정이 없어요.",
        ),
      ).toBeTruthy();
    },
  );

  it("빈 날짜를 선택해도 일정 영역을 유지하고 달력 밖 날짜는 해당 월로 이동한다", () => {
    render(<CalendarPlanningHarness referenceDate="2026-09-16" />);
    fireEvent.click(screen.getByRole("button", { name: "2026년 10월 1일" }));
    expect(
      screen.getByRole("table", { name: "2026년 10월 달력" }),
    ).toBeTruthy();
    expect(
      within(
        screen.getByRole("region", { name: "2026년 10월 1일 일정" }),
      ).getByText("이 날짜에 등록된 일정이 없어요."),
    ).toBeTruthy();
  });

  it("일정이 없는 경우에도 로딩과 오류를 빈 상태와 구분하고 재시도한다", () => {
    const onRetry = vi.fn();
    const view = render(
      <CalendarPlanningHarness
        referenceDate="2026-09-16"
        schedulesStatus="loading"
        onRetry={onRetry}
      />,
    );
    const region = screen.getByRole("region", { name: "2026년 9월 16일 일정" });
    expect(
      within(region).getByRole("status", { name: "일정을 불러오는 중이에요." }),
    ).toBeTruthy();
    expect(
      within(region).queryByText("이 날짜에 등록된 일정이 없어요."),
    ).toBeNull();
    view.rerender(
      <CalendarPlanningHarness
        referenceDate="2026-09-16"
        schedulesStatus="error"
        onRetry={onRetry}
      />,
    );
    expect(within(region).getByRole("alert")).toBeTruthy();
    fireEvent.click(within(region).getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "모바일 여부 %s에서 DatePicker의 연·월 선택만 사용하고 이동 시 말일을 보정한다",
    async (mobile) => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
      render(<CalendarPlanningHarness referenceDate="2026-01-31" />);
      const trigger = screen.getByRole("button", {
        name: "2026년 1월, 연·월 선택",
      });
      fireEvent.click(trigger);
      const picker = screen.getByRole("dialog", { name: "연·월 선택" });
      expect(picker.getAttribute("aria-modal")).toBe(String(mobile));
      expect(within(picker).queryByRole("grid")).toBeNull();
      expect(within(picker).queryByRole("gridcell")).toBeNull();
      expect(within(picker).getAllByRole("listbox")).toHaveLength(2);
      fireEvent.click(
        within(within(picker).getByRole("listbox", { name: "연도" })).getByRole(
          "option",
          { name: "2028년" },
        ),
      );
      fireEvent.click(
        within(within(picker).getByRole("listbox", { name: "월" })).getByRole(
          "option",
          { name: "2월" },
        ),
      );
      expect(
        screen.getByRole("table", { name: "2026년 1월 달력" }),
      ).toBeTruthy();
      fireEvent.click(within(picker).getByRole("button", { name: "이동" }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "연·월 선택" })).toBeNull(),
      );
      expect(
        screen
          .getByRole("button", { name: "2028년 2월 29일" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        screen.getByRole("region", { name: "2028년 2월 29일 일정" }),
      ).toBeTruthy();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    },
  );

  it.each([false, true])(
    "모바일 여부 %s에서 연·월 선택 취소와 재열기는 기존 날짜를 유지한다",
    async (mobile) => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
      render(<CalendarPlanningHarness referenceDate="2026-09-16" />);
      const trigger = screen.getByRole("button", {
        name: "2026년 9월, 연·월 선택",
      });
      fireEvent.click(trigger);
      let picker = screen.getByRole("dialog", { name: "연·월 선택" });
      const year = within(
        within(picker).getByRole("listbox", { name: "연도" }),
      ).getByRole("option", { name: "2027년" });
      fireEvent.click(year);
      fireEvent.keyDown(year, { key: "Escape" });
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "연·월 선택" })).toBeNull(),
      );
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      expect(
        screen
          .getByRole("button", { name: "2026년 9월 16일, 오늘" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      fireEvent.click(trigger);
      picker = screen.getByRole("dialog", { name: "연·월 선택" });
      expect(
        within(picker)
          .getByRole("option", { name: "2026년" })
          .getAttribute("aria-selected"),
      ).toBe("true");
      expect(
        within(picker)
          .getByRole("option", { name: "9월" })
          .getAttribute("aria-selected"),
      ).toBe("true");
      fireEvent.click(
        within(picker).getByRole("button", { name: "연·월 선택 닫기" }),
      );
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "연·월 선택" })).toBeNull(),
      );
    },
  );

  it("열린 연·월 선택을 PC와 모바일 전환 시 유지하고 기존 일자로 이동한다", async () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    render(<CalendarPlanningHarness referenceDate="2026-09-16" />);
    fireEvent.click(
      screen.getByRole("button", { name: "2026년 9월, 연·월 선택" }),
    );
    let picker = screen.getByRole("dialog", { name: "연·월 선택" });
    fireEvent.click(within(picker).getByRole("option", { name: "2027년" }));
    fireEvent.click(within(picker).getByRole("option", { name: "12월" }));
    await act(async () => media.setMatches(true));
    picker = screen.getByRole("dialog", { name: "연·월 선택" });
    expect(picker.getAttribute("aria-modal")).toBe("true");
    expect(
      within(picker)
        .getByRole("option", { name: "2027년" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      within(picker)
        .getByRole("option", { name: "12월" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(within(picker).queryByRole("grid")).toBeNull();
    await act(async () => media.setMatches(false));
    picker = screen.getByRole("dialog", { name: "연·월 선택" });
    expect(picker.getAttribute("aria-modal")).toBe("false");
    fireEvent.click(within(picker).getByRole("button", { name: "이동" }));
    expect(
      screen
        .getByRole("button", { name: "2027년 12월 16일" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
