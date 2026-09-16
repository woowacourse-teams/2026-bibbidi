import { createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WeddingDatePopover } from "./WeddingDatePopover";

function renderPopover(
  overrides: Partial<Parameters<typeof WeddingDatePopover>[0]> = {},
) {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  const returnFocusRef = createRef<HTMLElement>();
  returnFocusRef.current = trigger;
  const props = {
    initialDate: "2027-05-15",
    isSaving: false,
    onClose: vi.fn(),
    onSave: vi.fn(),
    returnFocusRef,
    saveError: null,
    ...overrides,
  };
  const result = render(<WeddingDatePopover {...props} />);
  return { ...result, props, trigger };
}

describe("WeddingDatePopover", () => {
  it("서버 날짜를 초기 선택으로 표시하고 선택만으로 저장하지 않는다", async () => {
    const { props } = renderPopover();
    const initialDay = screen.getByRole("button", { name: "2027년 5월 15일" });
    await waitFor(() => expect(document.activeElement).toBe(initialDay));
    expect(initialDay.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "2027년 5월 20일" }));
    expect(props.onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(props.onSave).toHaveBeenCalledWith("2027-05-20");
  });

  it("월과 연도를 이동하고 과거 날짜도 선택한다", () => {
    const { props } = renderPopover();
    fireEvent.click(screen.getByRole("button", { name: "이전 연도" }));
    fireEvent.click(screen.getByRole("button", { name: "이전 달" }));
    fireEvent.click(screen.getByRole("button", { name: "2026년 4월 3일" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(props.onSave).toHaveBeenCalledWith("2026-04-03");
  });

  it("월 이동 후에도 달력에 키보드 진입점이 유지된다", () => {
    renderPopover({ initialDate: "2027-01-31" });
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));

    expect(
      screen.getByRole("button", { name: "2027년 2월 28일" }).tabIndex,
    ).toBe(0);
  });

  it("화살표와 Home/End 키로 날짜 초점을 이동한다", async () => {
    renderPopover();
    const initialDay = screen.getByRole("button", { name: "2027년 5월 15일" });
    fireEvent.keyDown(initialDay, { key: "ArrowRight" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "2027년 5월 16일" }),
      ),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "2027년 5월 16일" }),
      ),
    );
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "2027년 5월 22일" }),
      ),
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "2027년 5월 29일" }),
      ),
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "2027년 5월 30일" }),
      ),
    );
  });

  it("Escape와 바깥 클릭으로 닫고 닫힌 뒤 트리거에 초점을 복원한다", async () => {
    const first = renderPopover();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(first.props.onClose).toHaveBeenCalledOnce();
    first.unmount();
    await waitFor(() => expect(document.activeElement).toBe(first.trigger));
    first.trigger.remove();

    const second = renderPopover();
    fireEvent.pointerDown(
      document.querySelector(".app-header-summary__popover-backdrop")!,
    );
    expect(second.props.onClose).toHaveBeenCalledOnce();
  });

  it("Tab 초점을 팝오버 안에 가두고 저장 중에는 닫기와 중복 저장을 막는다", () => {
    const { props } = renderPopover({ isSaving: true });
    const buttons = Array.from(
      screen
        .getByRole("dialog")
        .querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    ).filter((button) => button.tabIndex >= 0);
    const first = buttons[0];
    const last = buttons.at(-1)!;
    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.pointerDown(
      document.querySelector(".app-header-summary__popover-backdrop")!,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장 중..." }));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("날짜 미설정이면 저장을 비활성화하고 오류를 접근 가능한 상태로 표시한다", () => {
    renderPopover({ initialDate: null, saveError: "저장하지 못했습니다." });
    expect(
      screen.getByRole("button", { name: "저장" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("저장하지 못했습니다.");
  });
});
