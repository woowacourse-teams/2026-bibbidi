import { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { AppBottomNavigation } from "./AppBottomNavigation";
import { AppHeader } from "./AppHeader";

function renderHeader(
  user:
    | { kind: "guest" }
    | { kind: "pending" }
    | { kind: "authenticated"; summary: ReactNode; userInitial: string },
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
    expect(
      screen.getByRole("link", { name: "회원가입" }).getAttribute("href"),
    ).toBe("/signup");
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
        summary: <span>결혼 준비 현황</span>,
        userInitial: "비",
      },
      "/checklist",
    );

    expect(screen.getByText("결혼 준비 현황")).toBeTruthy();
    expect(screen.getByLabelText("현재 사용자 비")).toBeTruthy();

    const activeLinks = screen.getAllByRole("link", { name: "체크리스트" });
    expect(activeLinks).toHaveLength(1);
    activeLinks.forEach((link) =>
      expect(link.getAttribute("aria-current")).toBe("page"),
    );
  });

  it("하단 메뉴는 전체 서비스 경로와 현재 경로를 표시한다", () => {
    render(
      <MemoryRouter initialEntries={["/preparation"]}>
        <AppBottomNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "홈" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "체크리스트" })).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "준비 목록" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("브랜드와 전체 서비스 메뉴를 실제 경로에 연결한다", () => {
    renderHeader({ kind: "guest" });

    expect(
      screen.getByRole("link", { name: "비비디 홈" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: "체크리스트" }).getAttribute("href"),
    ).toBe("/checklist");
    expect(
      screen.getByRole("link", { name: "준비 목록" }).getAttribute("href"),
    ).toBe("/preparation");
  });
});
