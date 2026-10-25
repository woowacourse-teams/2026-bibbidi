import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DatePicker, type DatePickerRange } from "./DatePicker";

const today = "2027-05-15";

function ControlledRange() {
  const [value, setValue] = useState<DatePickerRange | null>(null);
  return (
    <DatePicker
      today={today}
      selectionMode="range"
      value={value}
      onChange={setValue}
    />
  );
}

function ControlledMultiple() {
  const [value, setValue] = useState([today]);
  return (
    <DatePicker
      today={today}
      selectionMode="multiple"
      value={value}
      onChange={setValue}
    />
  );
}

describe("DatePicker의 외부 선택값 동기화", () => {
  it("나중에 전달된 선택값의 월과 키보드 진입점을 표시하고 onChange를 호출하지 않는다", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DatePicker today={today} value="" onChange={onChange} />,
    );
    rerender(
      <DatePicker today={today} value="2028-08-20" onChange={onChange} />,
    );

    expect(screen.getByRole("grid", { name: "2028년 8월" })).toBeTruthy();
    const selected = screen.getByRole("gridcell", { name: /2028년 8월 20일/ });
    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(selected.tabIndex).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("부모가 같은 날짜 배열을 다시 전달해도 사용자가 탐색한 월을 유지한다", () => {
    const { rerender } = render(
      <DatePicker today={today} selectionMode="multiple" value={[today]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    rerender(
      <DatePicker today={today} selectionMode="multiple" value={[today]} />,
    );
    expect(screen.getByRole("grid", { name: "2027년 6월" })).toBeTruthy();
  });

  it("사용자가 다른 달에서 범위 종료일을 선택해도 시작일의 월로 돌아가지 않는다", () => {
    render(<ControlledRange />);
    fireEvent.click(screen.getByRole("gridcell", { name: /2027년 5월 15일/ }));
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    fireEvent.click(screen.getByRole("gridcell", { name: /2027년 6월 20일/ }));
    expect(screen.getByRole("grid", { name: "2027년 6월" })).toBeTruthy();
    expect(
      screen
        .getByRole("gridcell", { name: /2027년 6월 20일/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("다중 선택에서 다른 달의 날짜를 추가해도 현재 월을 유지한다", () => {
    render(<ControlledMultiple />);
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    fireEvent.click(screen.getByRole("gridcell", { name: /2027년 6월 20일/ }));
    expect(screen.getByRole("grid", { name: "2027년 6월" })).toBeTruthy();
    expect(
      screen
        .getByRole("gridcell", { name: /2027년 6월 20일/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("외부에서 범위를 변경하면 새 시작일을 표시하고 선택을 비워도 탐색 위치는 유지한다", () => {
    const { rerender } = render(
      <DatePicker
        today={today}
        selectionMode="range"
        value={{ start: today }}
      />,
    );
    rerender(
      <DatePicker
        today={today}
        selectionMode="range"
        value={{ start: "2028-07-10", end: "2028-08-20" }}
      />,
    );
    expect(screen.getByRole("grid", { name: "2028년 7월" })).toBeTruthy();
    expect(
      screen.getByRole("gridcell", { name: /2028년 7월 10일/ }).tabIndex,
    ).toBe(0);
    rerender(<DatePicker today={today} selectionMode="range" value={null} />);
    expect(screen.getByRole("grid", { name: "2028년 7월" })).toBeTruthy();
    expect(screen.queryAllByRole("gridcell", { selected: true })).toHaveLength(
      0,
    );
  });
});

describe("DatePicker 연월 목록 탐색", () => {
  it("전체 연도를 지원해도 보이는 항목만 렌더링하고 끝까지 키보드로 이동한다", () => {
    render(
      <DatePicker
        value="2026-10-26"
        today="2026-10-26"
        yearRange={{ start: 1, end: 9999 }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "2026년 10월" }));
    const years = screen.getByRole("listbox", { name: "연도" });
    expect(
      years.querySelectorAll('[role="option"]').length,
    ).toBeLessThanOrEqual(20);
    const selected = screen.getByRole("option", { name: "2026년" });
    fireEvent.keyDown(selected, { key: "End" });
    const last = screen.getByRole("option", { name: "9999년" });
    expect(document.activeElement).toBe(last);
    expect(last.getAttribute("aria-setsize")).toBe("9999");
    fireEvent.keyDown(last, { key: "Home" });
    expect(document.activeElement).toBe(
      screen.getByRole("option", { name: "1년" }),
    );
    fireEvent.scroll(years, { target: { scrollTop: 4000 * 44 } });
    expect(
      years.querySelectorAll('[role="option"]').length,
    ).toBeLessThanOrEqual(20);
    expect(years.querySelectorAll('[role="option"][tabindex="0"]').length).toBe(
      1,
    );
  });
  it("연도를 키보드로 바꿔도 날짜를 확정하지 않고 Escape로 달력에 돌아온다", () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        today={today}
        value={today}
        yearRange={{ start: 2026, end: 2028 }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "2027년 5월" }));
    const selectedYear = screen.getByRole("option", { name: "2027년" });
    expect(document.activeElement).toBe(selectedYear);
    fireEvent.keyDown(selectedYear, { key: "End" });
    const lastYear = screen.getByRole("option", { name: "2028년" });
    expect(lastYear.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(lastYear);
    fireEvent.keyDown(lastYear, { key: "ArrowDown" });
    expect(document.activeElement).toBe(lastYear);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(lastYear, { key: "Escape" });
    expect(screen.getByRole("grid", { name: "2028년 5월" })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "2028년 5월" }),
    );
  });

  it("선택 가능한 월 경계에서 키보드 이동을 제한하고 비활성 월 클릭은 무시한다", () => {
    render(
      <DatePicker
        today={today}
        value={today}
        minDate="2027-03-10"
        maxDate="2027-06-20"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "2027년 5월" }));
    fireEvent.keyDown(screen.getByRole("option", { name: "5월" }), {
      key: "Home",
    });
    const firstMonth = screen.getByRole("option", { name: "3월" });
    expect(document.activeElement).toBe(firstMonth);
    fireEvent.keyDown(firstMonth, { key: "ArrowUp" });
    expect(document.activeElement).toBe(firstMonth);
    fireEvent.click(screen.getByRole("option", { name: "1월" }));
    expect(firstMonth.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(firstMonth, { key: "End" });
    expect(document.activeElement).toBe(
      screen.getByRole("option", { name: "6월" }),
    );
  });
});
