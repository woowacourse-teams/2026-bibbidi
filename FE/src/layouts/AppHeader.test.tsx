import { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppBottomNavigation } from "./AppBottomNavigation";
import { AppHeader } from "./AppHeader";

function CurrentLocation() {
  return <output aria-label="현재 주소">{useLocation().pathname}</output>;
}

afterEach(() => {
  document.documentElement.scrollTop = 0;
});

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
  it.each(["contained", "document"] as const)(
    "%s 스크롤을 내리면 아이콘만 남고 위로 올리면 헤더를 복원한다",
    async (mode) => {
      const { container } = render(
        <MemoryRouter initialEntries={["/preparation"]}>
          <div data-modal-scope data-page-scroll-container data-scroll={mode}>
            <AppHeader user={{ kind: "guest" }} />
            <div data-testid="nested-scroll" />
          </div>
          <CurrentLocation />
        </MemoryRouter>,
      );
      const root =
        mode === "document"
          ? document.documentElement
          : container.querySelector<HTMLElement>(
              "[data-page-scroll-container]",
            )!;
      const target = mode === "document" ? document : root;
      expect(screen.getByRole("link", { name: "로그인" })).toBeTruthy();
      expect(
        screen.getByRole("navigation", { name: "주요 메뉴" }),
      ).toBeTruthy();
      const nested = screen.getByTestId("nested-scroll");
      nested.scrollTop = 100;
      fireEvent.scroll(nested);
      expect(screen.queryByRole("button", { name: "로그인" })).toBeNull();
      root.scrollTop = 100;
      fireEvent.scroll(target);
      const login = screen.getByRole("button", { name: "로그인" });
      expect(login.classList.contains("bibbidi-icon-button")).toBe(true);
      expect(login.textContent).toBe("");
      expect(screen.queryByRole("link", { name: "로그인" })).toBeNull();
      expect(
        screen.queryByRole("navigation", { name: "주요 메뉴" }),
      ).toBeNull();
      expect(
        container.querySelector(".app-header__left")?.hasAttribute("inert"),
      ).toBe(true);
      expect(
        container.querySelector(".app-header")?.hasAttribute("data-compact"),
      ).toBe(true);

      // Small scroll bounce must not bring the header back.
      root.scrollTop = 99;
      fireEvent.scroll(target);
      expect(screen.getByRole("button", { name: "로그인" })).toBeTruthy();

      root.scrollTop = 80;
      fireEvent.scroll(target);
      expect(
        screen.getByRole("navigation", { name: "주요 메뉴" }),
      ).toBeTruthy();
      expect(screen.getByRole("link", { name: "로그인" })).toBeTruthy();
      expect(
        container.querySelector(".app-header__left")?.hasAttribute("inert"),
      ).toBe(false);

      root.scrollTop = 120;
      fireEvent.scroll(target);
      expect(
        screen.queryByRole("navigation", { name: "주요 메뉴" }),
      ).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "로그인" }));
      expect(screen.getByLabelText("현재 주소").textContent).toBe("/login");
      root.scrollTop = 0;
      fireEvent.scroll(target);
      expect(screen.getByRole("link", { name: "로그인" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "로그인" })).toBeNull();
      expect(
        screen.getByRole("navigation", { name: "주요 메뉴" }),
      ).toBeTruthy();
    },
  );

  it("헤더가 사라져도 로그인 사용자의 계정 아이콘과 메뉴를 사용할 수 있다", () => {
    const { container } = renderHeader({
      kind: "authenticated",
      isLoggingOut: false,
      logoutErrorMessage: null,
      onLogout: vi.fn(),
      summary: <span>결혼 준비 현황</span>,
      userInitial: "비",
    });
    document.documentElement.scrollTop = 180;
    fireEvent.scroll(document);
    expect(
      container.querySelector(".app-header")?.hasAttribute("data-compact"),
    ).toBe(true);
    expect(screen.queryByRole("navigation", { name: "주요 메뉴" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
    expect(screen.getByRole("dialog", { name: "계정 메뉴" })).toBeTruthy();
    expect(screen.getByText("결혼 준비 현황")).toBeTruthy();
  });

  it("화면 크기에 따라 스크롤 영역이 바뀌면 로그인 버튼도 새 영역을 따라간다", async () => {
    const view = (mode: "document" | "contained") => (
      <MemoryRouter>
        <div data-modal-scope data-page-scroll-container data-scroll={mode}>
          <AppHeader user={{ kind: "guest" }} />
        </div>
      </MemoryRouter>
    );
    const { container, rerender } = render(view("contained"));
    const root = container.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    )!;
    root.scrollTop = 100;
    fireEvent.scroll(root);
    expect(screen.getByRole("button", { name: "로그인" })).toBeTruthy();
    rerender(view("document"));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "로그인" })).toBeTruthy(),
    );
    document.documentElement.scrollTop = 100;
    fireEvent.scroll(document);
    expect(screen.getByRole("button", { name: "로그인" })).toBeTruthy();
  });

  it("비로그인 사용자에게 로그인 링크를 표시하고 메뉴 버튼은 숨긴다", () => {
    renderHeader({ kind: "guest" });

    expect(screen.queryByRole("button", { name: "계정 메뉴" })).toBeNull();
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

    expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
    expect(screen.getByText("결혼 준비 현황")).toBeTruthy();
    expect(screen.getByLabelText("현재 사용자 비")).toBeTruthy();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeTruthy();

    const activeLinks = screen.getAllByRole("link", { name: "체크리스트" });
    expect(activeLinks).toHaveLength(1);
    activeLinks.forEach((link) =>
      expect(link.getAttribute("aria-current")).toBe("page"),
    );
  });

  it("패널 안의 로그아웃 버튼을 키보드로 사용할 수 있다", () => {
    const onLogout = vi.fn();
    renderHeader({
      kind: "authenticated",
      isLoggingOut: false,
      logoutErrorMessage: null,
      onLogout,
      summary: null,
      userInitial: "비",
    });
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
    const button = screen.getByRole("button", { name: "로그아웃" });

    expect(
      screen.getByRole("dialog", { name: "계정 메뉴" }).contains(button),
    ).toBe(true);
    expect(button.getAttribute("type")).toBe("button");
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button);
    expect(onLogout).toHaveBeenCalledOnce();
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
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
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
    fireEvent.click(screen.getByRole("button", { name: "로그아웃 다시 시도" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("하단 메뉴를 로드맵, 체크리스트, 캘린더 순서로 표시한다", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppBottomNavigation />
      </MemoryRouter>,
    );

    const links = screen.getByRole("navigation", { name: "하단 메뉴" });
    expect(
      Array.from(links.querySelectorAll("a"), (link) => link.textContent),
    ).toEqual(["로드맵", "체크리스트", "캘린더"]);
    expect(
      screen.getByRole("link", { name: "로드맵" }).getAttribute("href"),
    ).toBe("/preparation");
    expect(
      screen.getByRole("link", { name: "로드맵" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("브랜드와 데스크톱 메뉴를 실제 경로에 연결한다", () => {
    renderHeader({ kind: "guest" });

    const brandLink = screen.getByRole("link", { name: "비비디 홈" });
    expect(brandLink.getAttribute("href")).toBe("/");
    expect(brandLink.textContent).toBe("bibbidi");
    expect((brandLink as HTMLAnchorElement).draggable).toBe(false);
    expect(brandLink.querySelector<HTMLImageElement>("img")?.draggable).toBe(
      false,
    );
    const desktopLinks = Array.from(
      screen
        .getByRole("navigation", { name: "주요 메뉴" })
        .querySelectorAll("a"),
      (link) => [link.textContent, link.getAttribute("href")],
    );
    expect(desktopLinks).toEqual([
      ["로드맵", "/preparation"],
      ["체크리스트", "/checklist"],
      ["캘린더", "/calendar"],
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
