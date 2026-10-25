import { createRef, useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select, type SelectHandle } from "./Select";

const options = [
  { value: "prev", label: "예정" },
  { value: "done", label: "완료" },
];

describe("Select", () => {
  it("선택 목록을 모달 DOM 안에 유지하면서 top layer로 표시하고 Escape는 선택기만 닫는다", () => {
    render(
      <section role="dialog" aria-label="상세" aria-modal="true">
        <Select label="상태" options={options} value="prev" />
      </section>,
    );
    const trigger = screen.getByRole("combobox", { name: "상태" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const list = within(screen.getByRole("dialog")).getByRole("listbox");
    expect(list.getAttribute("popover")).toBe("manual");
    expect(list.matches(":popover-open")).toBe(true);
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
  });

  it("저장 중에는 초점과 열린 목록을 유지하면서 키보드·마우스의 중복 선택을 막는다", () => {
    const onChange = vi.fn();
    const view = render(
      <Select
        label="상태"
        options={options}
        value="prev"
        onChange={onChange}
        closeOnSelect={false}
      />,
    );
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);
    view.rerender(
      <Select
        label="상태"
        options={options}
        value="prev"
        onChange={onChange}
        closeOnSelect={false}
        loading
      />,
    );
    fireEvent.keyDown(trigger, { key: "End" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "완료" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("제어된 선택기의 저장 실패는 활성 옵션과 기존 선택값을 유지해 재시도할 수 있다", () => {
    const onChange = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <Select
          label="상태"
          options={options}
          value="prev"
          open={open}
          onOpenChange={setOpen}
          closeOnSelect={false}
          onChange={onChange}
          error={open ? "저장 실패" : undefined}
        />
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "End" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const complete = screen.getByRole("option", { name: "완료" });
    expect(onChange).toHaveBeenCalledWith("done");
    expect(trigger.getAttribute("aria-activedescendant")).toBe(complete.id);
    expect(complete.getAttribute("aria-selected")).toBe("false");
    expect(
      screen
        .getByRole("option", { name: "예정" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("저장 실패");
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

it.each(["prev", "done"])(
  "현재 선택값 %s를 마우스·키보드로 다시 고르면 변경 없이 닫는다",
  (value) => {
    const onChange = vi.fn();
    render(
      <Select
        label="상태"
        options={options}
        value={value}
        onChange={onChange}
        closeOnSelect={false}
      />,
    );
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);
    fireEvent.click(
      screen.getByRole("option", { name: value === "prev" ? "예정" : "완료" }),
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  },
);

function withoutPopover(run: () => void) {
  const prototype = HTMLElement.prototype;
  const show = Object.getOwnPropertyDescriptor(prototype, "showPopover")!;
  const hide = Object.getOwnPropertyDescriptor(prototype, "hidePopover")!;
  Object.defineProperties(prototype, {
    showPopover: { configurable: true, value: undefined },
    hidePopover: { configurable: true, value: undefined },
  });
  try {
    run();
  } finally {
    Object.defineProperties(prototype, {
      showPopover: show,
      hidePopover: hide,
    });
  }
}

it("Popover API가 없으면 네이티브 선택기로 변경·오류 초점을 처리한다", () => {
  withoutPopover(() => {
    const onChange = vi.fn();
    const ref = createRef<SelectHandle>();
    render(
      <Select
        ref={ref}
        label="카테고리"
        options={options}
        defaultValue="prev"
        onChange={onChange}
        required
        error="선택을 확인해 주세요."
      />,
    );
    const select = screen.getByRole("combobox", { name: "카테고리" });
    expect(select.tagName).toBe("SELECT");
    act(() => ref.current?.focus());
    expect(document.activeElement).toBe(select);
    expect(select.getAttribute("aria-hidden")).toBeNull();
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(
      document.getElementById(select.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe("선택을 확인해 주세요.");
    fireEvent.change(select, { target: { value: "done" } });
    expect((select as HTMLSelectElement).value).toBe("done");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("done");
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.invalid(select);
    expect(document.activeElement).toBe(select);
  });
});

it("Popover 미지원 환경에서도 readonly·저장 중 변경과 동일 값 요청을 차단한다", () => {
  withoutPopover(() => {
    const onChange = vi.fn();
    const view = render(
      <Select
        label="상태"
        options={options}
        value="prev"
        onChange={onChange}
      />,
    );
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "prev" } });
    expect(onChange).not.toHaveBeenCalled();
    view.rerender(
      <Select
        label="상태"
        options={options}
        value="prev"
        onChange={onChange}
        loading
      />,
    );
    expect((select as HTMLSelectElement).disabled).toBe(true);
    fireEvent.change(select, { target: { value: "done" } });
    view.rerender(
      <Select
        label="상태"
        options={options}
        value="prev"
        onChange={onChange}
        readOnly
      />,
    );
    fireEvent.change(select, { target: { value: "done" } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
