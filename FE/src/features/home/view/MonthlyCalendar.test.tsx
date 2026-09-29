import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonthlyCalendar } from "./MonthlyCalendar";

describe("MonthlyCalendar", () => {
  it("일요일 시작 6주 그리드에 앞뒤 달 날짜와 오늘을 표시한다", () => {
    render(<MonthlyCalendar referenceDate="2026-09-16" />);

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
    expect(within(calendar).queryByRole("button")).toBeNull();
  });

  it("이전 달과 다음 달을 탐색하고 오늘이 속한 달로 돌아온다", () => {
    render(<MonthlyCalendar referenceDate="2026-09-16" />);

    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(
      screen.getByRole("table", { name: "2026년 10월 달력" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "이전 달" }));
    fireEvent.click(screen.getByRole("button", { name: "이전 달" }));
    expect(screen.getByRole("table", { name: "2026년 8월 달력" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "오늘" }));
    expect(screen.getByRole("table", { name: "2026년 9월 달력" })).toBeTruthy();
  });

  it("저장된 일정을 해당 날짜에 제목과 추가 개수로 표시한다", () => {
    render(
      <MonthlyCalendar
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
    expect(within(september16!).getByText("드레스 투어")).toBeTruthy();
    expect(within(september16!).getByText("+1")).toBeTruthy();
    expect(within(september16!).queryByText("청첩장 수령")).toBeNull();
    expect(within(october1!).getByText("예복 가봉")).toBeTruthy();
  });
});
