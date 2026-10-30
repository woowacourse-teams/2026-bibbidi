import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

describe("DatePicker.MonthPicker의 독립 조합", () => {
  it("날짜 그리드 없이 연·월만 제어하고 YYYY-MM-01을 전달한다", () => {
    const onChange = vi.fn();
    const view = render(
      <DatePicker.MonthPicker
        value="2027-05-15"
        today={today}
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole("grid")).toBeNull();
    expect(screen.getAllByRole("listbox")).toHaveLength(2);
    fireEvent.click(screen.getByRole("option", { name: "2028년" }));
    expect(onChange).toHaveBeenLastCalledWith("2028-05-01");
    view.rerender(
      <DatePicker.MonthPicker
        value="2028-05-01"
        today={today}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("option", { name: "2월" }));
    expect(onChange).toHaveBeenLastCalledWith("2028-02-01");
  });

  it("범위 밖 월과 비활성 상태를 DatePicker와 같은 방식으로 제한한다", () => {
    const onChange = vi.fn();
    const view = render(
      <DatePicker.MonthPicker
        value="2027-05-01"
        today={today}
        minDate="2027-03-10"
        maxDate="2027-06-20"
        onChange={onChange}
      />,
    );
    expect(
      (screen.getByRole("option", { name: "1월" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("option", { name: "1월" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("option", { name: "5월" }), {
      key: "Home",
    });
    expect(onChange).toHaveBeenLastCalledWith("2027-03-01");
    view.rerender(
      <DatePicker.MonthPicker
        value="2027-05-01"
        today={today}
        disabled
        onChange={onChange}
      />,
    );
    onChange.mockClear();
    fireEvent.click(screen.getByRole("option", { name: "6월" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("group", { name: "연·월 선택" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });
});

it("숨겨진 연·월 목록이 열리면 현재 연도가 보이는 위치로 스크롤한다", () => {
  const callbacks = new Map<Element, () => void>();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
      }
      observe(target: Element) {
        callbacks.set(target, this.callback);
      }
      disconnect() {}
    },
  );
  try {
    const onChange = vi.fn();
    const view = render(
      <div hidden>
        <DatePicker.MonthPicker
          today="2026-10-27"
          value="2026-10-01"
          onChange={onChange}
        />
      </div>,
    );
    const years = screen.getByRole("listbox", { name: "연도", hidden: true });
    let height = 0;
    Object.defineProperty(years, "clientHeight", { get: () => height });
    expect(years.scrollTop).toBe(0);
    view.rerender(
      <div>
        <DatePicker.MonthPicker
          today="2026-10-27"
          value="2026-10-01"
          onChange={onChange}
        />
      </div>,
    );
    height = 220;
    act(() => callbacks.get(years)?.());
    const selectedYearOffset = 20 + 100 * 44;
    expect(selectedYearOffset).toBeGreaterThanOrEqual(years.scrollTop);
    expect(selectedYearOffset).toBeLessThan(years.scrollTop + height);
    expect(onChange).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
