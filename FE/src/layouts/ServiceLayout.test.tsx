import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../features/auth";
import { ServiceLayout } from "./ServiceLayout";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ServiceLayout", () => {
  it("인증 확인 중에도 서비스 화면과 안정적인 헤더 영역을 표시한다", async () => {
    let resolveCurrentUser: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveCurrentUser = resolve;
          }),
      ),
    );

    render(
      <AuthProvider>
        <MemoryRouter>
          <Routes>
            <Route element={<ServiceLayout />}>
              <Route path="/" element={<div>홈 화면</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByText("홈 화면")).toBeTruthy();
    expect(
      screen.getByRole("status", { name: "로그인 상태 확인 중" }),
    ).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "계정 메뉴" })).toBeNull();

    await act(async () => {
      resolveCurrentUser(
        new Response(JSON.stringify({ nickname: "비비디" }), { status: 200 }),
      );
    });

    expect(await screen.findByLabelText("현재 사용자 비")).toBeTruthy();
  });

  it("서비스 경로가 변경되면 콘텐츠 스크롤을 맨 위로 초기화한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nickname: "bibbidi" }), {
          status: 200,
        }),
      ),
    );

    const { container } = render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/preparation"]}>
          <Routes>
            <Route element={<ServiceLayout />}>
              <Route path="/" element={<div>홈 화면</div>} />
              <Route path="/preparation" element={<div>준비 목록 화면</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
    await screen.findByText("준비 목록 화면");
    const content = container.querySelector<HTMLElement>(
      ".service-layout__content",
    );

    expect(content).not.toBeNull();
    if (!content) {
      return;
    }

    content.scrollTop = 700;

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "하단 메뉴" })).getByRole(
        "link",
        { name: "홈" },
      ),
    );

    expect(screen.getByText("홈 화면")).toBeTruthy();
    expect(content.scrollTop).toBe(0);
  });

  it("현재 사용자 닉네임으로 로그인 헤더를 표시한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nickname: "비비디" }), {
          status: 200,
        }),
      ),
    );

    render(
      <AuthProvider>
        <MemoryRouter>
          <Routes>
            <Route element={<ServiceLayout />}>
              <Route path="/" element={<div>홈 화면</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByLabelText("현재 사용자 비")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "로그인" })).toBeNull();
  });

  it("비로그인 사용자에게 계정 메뉴를 표시한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
            { status: 401 },
          ),
        ),
    );

    render(
      <AuthProvider>
        <MemoryRouter>
          <Routes>
            <Route element={<ServiceLayout />}>
              <Route path="/" element={<div>홈 화면</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByRole("link", { name: "로그인" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "회원가입" })).toBeTruthy();
  });
});
