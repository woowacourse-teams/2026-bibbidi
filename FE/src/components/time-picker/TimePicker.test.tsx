import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimePicker } from "./TimePicker";

afterEach(() => vi.useRealTimers());

function Controlled({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("09:13");
  return (
    <TimePicker
      value={value}
      minuteStep={1}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("TimePicker", () => {
  it.each(["클릭", "키보드"])(
    "%s으로 현재 시각을 다시 선택해도 명시적인 선택을 전달한다",
    (method) => {
      const onChange = vi.fn();
      const view = render(<TimePicker value="00:00" onChange={onChange} />);
      const minutes = screen.getByRole("listbox", { name: "분" });
      fireEvent.scroll(minutes);
      view.rerender(<TimePicker value="00:00" onChange={onChange} />);
      expect(onChange).not.toHaveBeenCalled();
      if (method === "클릭")
        fireEvent.click(within(minutes).getByRole("option", { name: "00" }));
      else fireEvent.keyDown(minutes, { key: "Home" });
      expect(onChange).toHaveBeenCalledExactlyOnceWith("00:00");
    },
  );

  it("오전·오후와 키보드 선택을 24시간제의 1분 값으로 전달한다", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const period = screen.getByRole("listbox", { name: "오전·오후" });
    fireEvent.keyDown(period, { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith("21:13");
    fireEvent.keyDown(screen.getByRole("listbox", { name: "시" }), {
      key: "Home",
    });
    expect(onChange).toHaveBeenLastCalledWith("12:13");
    fireEvent.keyDown(period, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("00:13");
    fireEvent.keyDown(screen.getByRole("listbox", { name: "분" }), {
      key: "End",
    });
    expect(onChange).toHaveBeenLastCalledWith("00:59");
  });

  it("스크롤이 멈춘 위치를 1분 단위로 선택한다", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const minutes = screen.getByRole("listbox", { name: "분" });
    minutes.scrollTop = 17 * 44;
    fireEvent.scroll(minutes);
    act(() => vi.advanceTimersByTime(120));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("09:17");
    expect(
      within(minutes)
        .getByRole("option", { name: "17" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it.each(["disabled", "readOnly"] as const)(
    "%s 상태에서는 클릭·키보드·스크롤로 값을 바꾸지 않는다",
    (state) => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      render(
        <TimePicker
          value="09:13"
          minuteStep={1}
          onChange={onChange}
          {...{ [state]: true }}
        />,
      );
      const minutes = screen.getByRole("listbox", { name: "분" });
      fireEvent.click(within(minutes).getByRole("option", { name: "14" }));
      fireEvent.keyDown(minutes, { key: "ArrowDown" });
      minutes.scrollTop = 17 * 44;
      fireEvent.scroll(minutes);
      act(() => vi.advanceTimersByTime(120));
      expect(onChange).not.toHaveBeenCalled();
      expect(minutes.scrollTop).toBe(13 * 44);
    },
  );
});
