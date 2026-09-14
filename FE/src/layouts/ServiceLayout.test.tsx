import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../features/auth";
import { PreparationRoadmapFeature } from "../features/preparation/PreparationRoadmapFeature";
import { preparationCatalogResponseFixture } from "../features/preparation/test/fixtures/preparationCatalogResponse.fixture";
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
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nickname: "비비디" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1,
            items: [
              { id: 10, isDone: true },
              { id: 11, isDone: false },
              { id: 12, isDone: true },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

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
    expect(await screen.findByText("67%")).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "로그인" })).toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/checklists/me",
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
  });

  it("비로그인 사용자에게 계정 메뉴를 표시한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
          { status: 401 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

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
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("체크리스트 인증 만료 시 로그인 상태를 다시 확인한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nickname: "비비디" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
          { status: 401 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

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
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("준비 목록과 헤더가 내 체크리스트 조회를 공유한다", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/users/me") {
        return Promise.resolve(
          new Response(JSON.stringify({ nickname: "비비디" }), { status: 200 }),
        );
      }

      if (url === "/api/catalog") {
        return Promise.resolve(
          new Response(JSON.stringify(preparationCatalogResponseFixture), {
            status: 200,
          }),
        );
      }

      if (url === "/api/checklists/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              items: [
                { id: 10, isDone: true, sourceCatalogItemId: 101 },
                { id: 11, isDone: false, sourceCatalogItemId: 102 },
              ],
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/preparation"]}>
          <Routes>
            <Route element={<ServiceLayout />}>
              <Route
                path="/preparation"
                element={<PreparationRoadmapFeature />}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "준비 로드맵" }),
    ).toBeTruthy();
    expect(await screen.findByText("50%")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/checklists/me"),
    ).toHaveLength(1);
  });
});
