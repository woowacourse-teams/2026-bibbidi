import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { containTabFocus, focusFirstElement } from "./containTabFocus";

describe("공통 초점 이동", () => {
  it("숨김·비활성 영역을 건너뛰고 처음 사용할 수 있는 컨트롤에 진입한다", () => {
    const { container } = render(
      <div>
        <input type="hidden" />
        <button hidden>숨김</button>
        <div style={{ display: "none" }}>
          <button>숨긴 부모</button>
        </div>
        <div style={{ visibility: "hidden" }}>
          <button>보이지 않는 버튼</button>
        </div>
        <div inert>
          <button>비활성 영역</button>
        </div>
        <button disabled>비활성 버튼</button>
        <button tabIndex={-1}>탭 제외</button>
        <button>첫 동작</button>
        <button>마지막 동작</button>
      </div>,
    );
    focusFirstElement(container);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "첫 동작" }),
    );
  });

  it("앞뒤에 숨긴 컨트롤이 있어도 Tab과 Shift+Tab이 보이는 컨트롤 사이를 순환한다", () => {
    const { container } = render(
      <div>
        <button hidden>숨긴 첫 버튼</button>
        <button>첫 동작</button>
        <button>마지막 동작</button>
        <div style={{ display: "none" }}>
          <button>숨긴 마지막 버튼</button>
        </div>
      </div>,
    );
    const first = screen.getByRole("button", { name: "첫 동작" });
    const last = screen.getByRole("button", { name: "마지막 동작" });
    const preventDefault = vi.fn();
    last.focus();
    containTabFocus({ key: "Tab", shiftKey: false, preventDefault }, container);
    expect(document.activeElement).toBe(first);
    first.focus();
    containTabFocus({ key: "Tab", shiftKey: true, preventDefault }, container);
    expect(document.activeElement).toBe(last);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it("모든 컨트롤이 숨겨진 경우 Tab으로 영역 밖에 나가지 않는다", () => {
    const { container } = render(
      <div>
        <button hidden>숨김</button>
      </div>,
    );
    const preventDefault = vi.fn();
    containTabFocus({ key: "Tab", shiftKey: false, preventDefault }, container);
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
