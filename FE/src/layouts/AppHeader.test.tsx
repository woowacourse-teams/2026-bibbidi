import { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppBottomNavigation } from "./AppBottomNavigation";
import { AppHeader } from "./AppHeader";

function renderHeader(
  user:
    | { kind: "guest" }
    | { kind: "pending" }
    | {
        kind: "authenticated";
        isLoggingOut: boolean;
        logoutErrorMessage: string | null;
        onLogout: () => void;
        summary: ReactNode;
        userInitial: string;
      },
  path = "/",
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppHeader user={user} />
    </MemoryRouter>,
  );
}

describe("AppHeader", () => {
  it("비로그인 사용자에게 계정 메뉴를 표시한다", () => {
    renderHeader({ kind: "guest" });

    expect(screen.getByRole("navigation", { name: "계정 메뉴" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "로그인" }).getAttribute("href"),
    ).toBe("/login");
    expect(screen.queryByRole("link", { name: "회원가입" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "하단 메뉴" })).toBeNull();
  });

  it("인증 확인 중에는 계정 메뉴 대신 자리를 유지한다", () => {
    renderHeader({ kind: "pending" });

    expect(
      screen.getByRole("status", { name: "로그인 상태 확인 중" }),
    ).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "계정 메뉴" })).toBeNull();
  });

  it("로그인 사용자에게 요약과 사용자 정보를 표시한다", () => {
    renderHeader(
      {
        kind: "authenticated",
        isLoggingOut: false,
        logoutErrorMessage: null,
        onLogout: vi.fn(),
        summary: <span>결혼 준비 현황</span>,
        userInitial: "비",
      },
      "/checklist",
    );

    expect(screen.getByText("결혼 준비 현황")).toBeTruthy();
    expect(screen.getByLabelText("현재 사용자 비")).toBeTruthy();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeTruthy();

    const activeLinks = screen.getAllByRole("link", { name: "체크리스트" });
    expect(activeLinks).toHaveLength(1);
    activeLinks.forEach((link) =>
      expect(link.getAttribute("aria-current")).toBe("page"),
    );
  });

  it("로그아웃 버튼을 이니셜 오른쪽에 두고 키보드로 사용할 수 있다", () => {
    const onLogout = vi.fn();
    const { container } = renderHeader({
      kind: "authenticated",
      isLoggingOut: false,
      logoutErrorMessage: null,
      onLogout,
      summary: null,
      userInitial: "비",
    });
    const initial = screen.getByLabelText("현재 사용자 비");
    const button = screen.getByRole("button", { name: "로그아웃" });

    expect(initial.nextElementSibling).toBe(button);
    expect(button.getAttribute("type")).toBe("button");
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button);
    expect(onLogout).toHaveBeenCalledOnce();
    expect(container.querySelector(".app-header__logout")).toBe(button);
  });

  it("처리 중 버튼을 비활성화하고 실패 안내에서 재시도할 수 있다", () => {
    const onLogout = vi.fn();
    const { rerender } = renderHeader({
      kind: "authenticated",
      isLoggingOut: true,
      logoutErrorMessage: null,
      onLogout,
      summary: null,
      userInitial: "비",
    });
    const button = screen.getByRole("button", { name: "로그아웃" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("로그아웃 처리 중");

    rerender(
      <MemoryRouter>
        <AppHeader
          user={{
            kind: "authenticated",
            isLoggingOut: false,
            logoutErrorMessage: "잠시 후 다시 시도해 주세요.",
            onLogout,
            summary: null,
            userInitial: "비",
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "잠시 후 다시 시도해 주세요.",
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("하단 메뉴를 로드맵, 체크리스트, 플래너 순서로 표시한다", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppBottomNavigation />
      </MemoryRouter>,
    );

    const links = screen.getByRole("navigation", { name: "하단 메뉴" });
    expect(
      Array.from(links.querySelectorAll("a"), (link) => link.textContent),
    ).toEqual(["로드맵", "체크리스트", "플래너"]);
    expect(
      screen.getByRole("link", { name: "로드맵" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: "로드맵" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("브랜드와 데스크톱 메뉴를 실제 경로에 연결한다", () => {
    renderHeader({ kind: "guest" });

    expect(
      screen.getByRole("link", { name: "비비디 홈" }).getAttribute("href"),
    ).toBe("/");
    const desktopLinks = Array.from(
      screen
        .getByRole("navigation", { name: "주요 메뉴" })
        .querySelectorAll("a"),
      (link) => [link.textContent, link.getAttribute("href")],
    );
    expect(desktopLinks).toEqual([
      ["로드맵", "/"],
      ["체크리스트", "/checklist"],
      ["플래너", "/planner"],
    ]);
    expect(screen.queryByRole("link", { name: "준비 목록" })).toBeNull();
  });

  it("모바일 로드맵은 하위가 아닌 루트에서만 활성화된다", () => {
    render(
      <MemoryRouter initialEntries={["/checklist"]}>
        <AppBottomNavigation />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "로드맵" }).hasAttribute("aria-current"),
    ).toBe(false);
    expect(
      screen
        .getByRole("link", { name: "체크리스트" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});
