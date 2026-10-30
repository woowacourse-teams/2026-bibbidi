import { createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WeddingDateDialog } from "./WeddingDateDialog";

function renderDialog(
  overrides: Partial<Parameters<typeof WeddingDateDialog>[0]> = {},
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
  const result = render(<WeddingDateDialog {...props} />);
  return { ...result, props, trigger };
}

describe("WeddingDateDialog", () => {
  it("서버 날짜를 초기 선택으로 표시하고 선택만으로 저장하지 않는다", async () => {
    const { props } = renderDialog();
    const initialDay = screen.getByRole("gridcell", {
      name: /2027년 5월 15일/,
    });
    await waitFor(() => expect(document.activeElement).toBe(initialDay));
    expect(initialDay.getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("gridcell", { name: /2027년 5월 20일/ }));
    expect(props.onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(props.onSave).toHaveBeenCalledWith("2027-05-20");
  });

  it("월과 연도를 이동하고 과거 날짜도 선택한다", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "2027년 5월" }));
    fireEvent.click(screen.getByRole("option", { name: "2026년" }));
    fireEvent.click(
      screen.getByRole("button", { name: "날짜 선택으로 돌아가기" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "이전 달" }));
    fireEvent.click(screen.getByRole("gridcell", { name: /2026년 4월 3일/ }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(props.onSave).toHaveBeenCalledWith("2026-04-03");
  });

  it("월 이동 후에도 달력에 키보드 진입점이 유지된다", () => {
    renderDialog({ initialDate: "2027-01-31" });
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));

    expect(
      screen.getByRole("gridcell", { name: /2027년 2월 1일/ }).tabIndex,
    ).toBe(0);
  });

  it("화살표와 Home/End 키로 날짜 초점을 이동한다", async () => {
    renderDialog();
    const initialDay = screen.getByRole("gridcell", {
      name: /2027년 5월 15일/,
    });
    fireEvent.keyDown(initialDay, { key: "ArrowRight" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("gridcell", { name: /2027년 5월 16일/ }),
      ),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("gridcell", { name: /2027년 5월 16일/ }),
      ),
    );
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("gridcell", { name: /2027년 5월 22일/ }),
      ),
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("gridcell", { name: /2027년 5월 29일/ }),
      ),
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("gridcell", { name: /2027년 5월 30일/ }),
      ),
    );
  });

  it.each([
    ["1800-05-15", "1800년 5월 15일"],
    ["2300-05-15", "2300년 5월 15일"],
  ])(
    "기본 연도 범위 밖의 저장 날짜 %s도 그대로 표시하고 저장한다",
    (initialDate, label) => {
      const { props } = renderDialog({ initialDate });
      expect(
        screen
          .getByRole("gridcell", { name: new RegExp(label) })
          .getAttribute("aria-selected"),
      ).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      expect(props.onSave).toHaveBeenCalledWith(initialDate);
    },
  );

  it.each([
    ["0001-01-01", "ArrowLeft", "1년 1월 1일"],
    ["9999-12-31", "ArrowRight", "9999년 12월 31일"],
  ])(
    "지원 범위 경계 %s에서 %s 키 이동을 경계 날짜로 제한한다",
    async (initialDate, key, accessibleName) => {
      renderDialog({ initialDate });
      const boundaryDay = screen.getByRole("gridcell", {
        name: new RegExp(accessibleName),
      });

      fireEvent.keyDown(boundaryDay, { key });

      await waitFor(() => expect(document.activeElement).toBe(boundaryDay));
      expect(screen.queryByText(/(?:0|10000)년/)).toBeNull();
    },
  );

  it("Escape와 바깥 클릭으로 닫고 닫힌 뒤 트리거에 초점을 복원한다", async () => {
    const first = renderDialog();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(first.props.onClose).toHaveBeenCalledOnce();
    first.unmount();
    await waitFor(() => expect(document.activeElement).toBe(first.trigger));
    first.trigger.remove();

    const second = renderDialog();
    fireEvent.pointerDown(screen.getByRole("dialog"), {
      isPrimary: true,
      clientX: -1,
      clientY: -1,
    });
    fireEvent.pointerUp(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("dialog"));
    expect(second.props.onClose).toHaveBeenCalledOnce();
  });

  it("연월 선택의 Escape는 날짜 선택으로 돌아오고 팝오버를 유지한다", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "2027년 5월" }));
    const year = screen.getByRole("listbox", { name: "연도" });
    expect(document.activeElement).toBe(
      screen.getByRole("option", { name: "2027년" }),
    );
    fireEvent.keyDown(year, { key: "Escape" });
    expect(screen.getByRole("grid", { name: "2027년 5월" })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "2027년 5월" }),
    );
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("Tab 초점을 팝오버 안에 가두고 연월 선택도 순환한다", () => {
    renderDialog();
    const first = screen.getByRole("button", { name: "2027년 5월" });
    const last = screen.getByRole("button", { name: "저장" });
    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.click(first);
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("저장 중에는 날짜 변경과 닫기 및 중복 저장을 막는다", () => {
    const { props } = renderDialog({ isSaving: true });
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
    expect(
      screen
        .getAllByRole("gridcell")
        .filter((cell) => cell.tagName === "BUTTON")
        .every((cell) => cell.hasAttribute("disabled")),
    ).toBe(true);
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.pointerDown(screen.getByRole("dialog"), {
      isPrimary: true,
      clientX: -1,
      clientY: -1,
    });
    fireEvent.pointerUp(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("button", { name: "저장 중..." }));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("날짜 미설정이면 저장을 비활성화하고 오류를 접근 가능한 상태로 표시한다", () => {
    renderDialog({ initialDate: null, saveError: "저장하지 못했습니다." });
    expect(
      screen.getByRole("button", { name: "저장" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("저장하지 못했습니다.");
  });
});
