import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, useNavigate } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "./AppHeader";

function Summary() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>준비 현황 {count}</button>;
}

function GoBack() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>이전 화면</button>;
}

function renderMenu() {
  return render(
    <MemoryRouter>
      <AppHeader
        user={{
          kind: "authenticated",
          isLoggingOut: false,
          logoutErrorMessage: null,
          onLogout: vi.fn(),
          summary: <Summary />,
          userInitial: "비",
        }}
      />
      <Link to="/calendar">바깥 링크</Link>
      <GoBack />
    </MemoryRouter>,
  );
}

describe("헤더 계정 패널", () => {
  it("아이콘 하나로 열고 닫으며 숨겨진 항목은 탐색에서 제외한다", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "계정 메뉴" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
    fireEvent.click(trigger);
    const panel = screen.getByRole("dialog", { name: "계정 메뉴" });
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(panel);
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("패널을 열고 Escape로 닫아 아이콘으로 돌아온다", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "계정 메뉴" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("button", { name: "계정 메뉴 닫기" }), {
      key: "Escape",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it.each(["pointer", "focus"])("바깥 %s 이동으로 닫는다", (method) => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
    const outside = screen.getByRole("link", { name: "바깥 링크" });
    if (method === "pointer") fireEvent.pointerDown(outside);
    else fireEvent.focusIn(outside);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("다시 열어도 준비 현황의 상태를 보존한다", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "계정 메뉴" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "준비 현황 0" }));
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "준비 현황 1" })).toBeTruthy();
  });

  it("화면 이동과 뒤로가기에서 패널만 닫고 준비 현황 상태를 유지한다", () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
    fireEvent.click(screen.getByRole("button", { name: "준비 현황 0" }));
    fireEvent.click(screen.getByRole("link", { name: "바깥 링크" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "이전 화면" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
    expect(screen.getByRole("button", { name: "준비 현황 1" })).toBeTruthy();
  });
});
