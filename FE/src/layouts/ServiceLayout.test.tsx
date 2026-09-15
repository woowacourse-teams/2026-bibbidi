import { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../features/auth";
import { ChecklistFeature } from "../features/checklist";
import { ChecklistMigrationProvider } from "../features/checklist-migration";
import { PreparationRoadmapFeature } from "../features/preparation/PreparationRoadmapFeature";
import { preparationCatalogResponseFixture } from "../features/preparation/test/fixtures/preparationCatalogResponse.fixture";
import { ServiceLayout } from "./ServiceLayout";

function createChecklistItem(
  id: number,
  sourceCatalogItemId: number | null,
  isDone = false,
) {
  return {
    appointments: [],
    categoryId: 10,
    id,
    isDone,
    sourceCatalogItemId,
    title: `체크리스트 항목 ${id}`,
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: vi.fn().mockReturnValue(null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderServiceLayout(
  routes: ReactNode,
  initialEntries: string[] = ["/"],
) {
  return render(
    <AuthProvider>
      <ChecklistMigrationProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route element={<ServiceLayout />}>{routes}</Route>
          </Routes>
        </MemoryRouter>
      </ChecklistMigrationProvider>
    </AuthProvider>,
  );
}

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

    renderServiceLayout(<Route path="/" element={<div>홈 화면</div>} />);

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

    const { container } = renderServiceLayout(
      <>
        <Route path="/" element={<div>홈 화면</div>} />
        <Route path="/preparation" element={<div>준비 목록 화면</div>} />
      </>,
      ["/preparation"],
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
              createChecklistItem(10, null, true),
              createChecklistItem(11, null),
              createChecklistItem(12, null, true),
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderServiceLayout(<Route path="/" element={<div>홈 화면</div>} />);

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

    renderServiceLayout(<Route path="/" element={<div>홈 화면</div>} />);

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

    renderServiceLayout(<Route path="/" element={<div>홈 화면</div>} />);

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
                createChecklistItem(10, 101, true),
                createChecklistItem(11, 102),
              ],
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderServiceLayout(
      <Route path="/preparation" element={<PreparationRoadmapFeature />} />,
      ["/preparation"],
    );

    expect(
      await screen.findByRole("heading", { name: "준비 로드맵" }),
    ).toBeTruthy();
    expect(await screen.findByText("50%")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/checklists/me"),
    ).toHaveLength(1);
  });

  it("체크리스트 화면·헤더·상세 패널이 내 체크리스트 GET 요청을 공유한다", async () => {
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
              items: [createChecklistItem(10, 1001, true)],
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderServiceLayout(
      <Route path="/checklist" element={<ChecklistFeature />} />,
      ["/checklist"],
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /체크리스트 항목 10/ }),
    );

    expect(
      screen.getByRole("complementary", { name: "체크리스트 항목 10" }),
    ).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/checklists/me"),
    ).toHaveLength(1);
  });

  it("준비 항목 추가 직후 헤더와 체크리스트 화면을 공통 캐시에서 함께 갱신한다", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/users/me") {
          return Promise.resolve(
            new Response(JSON.stringify({ nickname: "비비디" }), {
              status: 200,
            }),
          );
        }

        if (url === "/api/catalog") {
          return Promise.resolve(
            new Response(JSON.stringify(preparationCatalogResponseFixture), {
              status: 200,
            }),
          );
        }

        if (url === "/api/checklists/me" && init?.method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 1,
                items: [createChecklistItem(10, 1001, true)],
              }),
              { status: 200 },
            ),
          );
        }

        if (
          url === "/api/checklists/me/catalog-items" &&
          init?.method === "POST"
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    catalogItemId: 1002,
                    categoryId: 10,
                    id: 11,
                    status: "prev",
                    title: "서버가 추가한 두 번째 할 일",
                  },
                ],
              }),
              { status: 201 },
            ),
          );
        }

        return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
      });
    vi.stubGlobal("fetch", fetchMock);

    renderServiceLayout(
      <Route
        path="/preparation"
        element={
          <>
            <PreparationRoadmapFeature />
            <ChecklistFeature />
          </>
        }
      />,
      ["/preparation"],
    );

    expect(await screen.findByText("1/1")).toBeTruthy();
    expect(await screen.findByText("체크리스트 항목 10")).toBeTruthy();
    fireEvent.click(
      await screen.findByRole("button", { name: "두 번째 할 일 추가" }),
    );

    expect(await screen.findByText("1/2")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "결혼 준비 현황" })).getByText(
        "50%",
      ),
    ).toBeTruthy();
    expect(await screen.findByText("서버가 추가한 두 번째 할 일")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/checklists/me" && init?.method === "GET",
      ),
    ).toHaveLength(1);
  });

  it("Migration 중 체크리스트를 숨기고 완료 후 최신 서버 결과를 표시한다", async () => {
    let serializedValue: string | null = JSON.stringify({
      version: 1,
      catalogItemIds: [1002],
    });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => serializedValue),
      removeItem: vi.fn(() => {
        serializedValue = null;
      }),
      setItem: vi.fn((_key: string, value: string) => {
        serializedValue = value;
      }),
    });
    let resolveAddition: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/users/me") {
          return Promise.resolve(
            new Response(JSON.stringify({ nickname: "비비디" }), {
              status: 200,
            }),
          );
        }

        if (url === "/api/catalog") {
          return Promise.resolve(
            new Response(JSON.stringify(preparationCatalogResponseFixture), {
              status: 200,
            }),
          );
        }

        if (url === "/api/checklists/me" && init?.method === "GET") {
          const checklistRequestCount = fetchMock.mock.calls.filter(
            ([requestedUrl]) => requestedUrl === "/api/checklists/me",
          ).length;

          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 1,
                items:
                  checklistRequestCount === 1
                    ? [createChecklistItem(10, 1001, true)]
                    : [
                        createChecklistItem(10, 1001, true),
                        createChecklistItem(11, 1002),
                      ],
              }),
              { status: 200 },
            ),
          );
        }

        if (url === "/api/checklists/me/catalog-items") {
          return new Promise<Response>((resolve) => {
            resolveAddition = resolve;
          });
        }

        return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
      });
    vi.stubGlobal("fetch", fetchMock);

    renderServiceLayout(
      <Route path="/checklist" element={<ChecklistFeature />} />,
      ["/checklist"],
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => url === "/api/checklists/me/catalog-items",
        ),
      ).toBe(true),
    );
    expect(screen.getByText("체크리스트를 불러오고 있어요.")).toBeTruthy();
    expect(screen.queryByText("체크리스트 항목 10")).toBeNull();

    await act(async () => {
      resolveAddition(
        new Response(
          JSON.stringify({
            items: [
              {
                catalogItemId: 1002,
                categoryId: 10,
                id: 11,
                status: "prev",
                title: "체크리스트 항목 11",
              },
            ],
          }),
          { status: 201 },
        ),
      );
    });

    expect(await screen.findByText("체크리스트 항목 11")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/checklists/me"),
    ).toHaveLength(1);
  });

  it("병합 완료 전 서버 상태를 숨기고 완료 후 최신 조회를 공유한다", async () => {
    let serializedValue: string | null = JSON.stringify({
      version: 1,
      catalogItemIds: [1002],
    });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => serializedValue),
      removeItem: vi.fn(() => {
        serializedValue = null;
      }),
      setItem: vi.fn((_key: string, value: string) => {
        serializedValue = value;
      }),
    });
    let resolveAddition: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/users/me") {
          return Promise.resolve(
            new Response(JSON.stringify({ nickname: "비비디" }), {
              status: 200,
            }),
          );
        }

        if (url === "/api/catalog") {
          return Promise.resolve(
            new Response(JSON.stringify(preparationCatalogResponseFixture), {
              status: 200,
            }),
          );
        }

        if (url === "/api/checklists/me" && init?.method === "GET") {
          const checklistRequestCount = fetchMock.mock.calls.filter(
            ([requestedUrl]) => requestedUrl === "/api/checklists/me",
          ).length;

          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 1,
                items:
                  checklistRequestCount === 1
                    ? [createChecklistItem(10, 1001, true)]
                    : [
                        createChecklistItem(10, 1001, true),
                        createChecklistItem(11, 1002),
                      ],
              }),
              { status: 200 },
            ),
          );
        }

        if (url === "/api/checklists/me/catalog-items") {
          return new Promise<Response>((resolve) => {
            resolveAddition = resolve;
          });
        }

        return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
      });
    vi.stubGlobal("fetch", fetchMock);

    renderServiceLayout(
      <Route path="/preparation" element={<PreparationRoadmapFeature />} />,
      ["/preparation"],
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => url === "/api/checklists/me/catalog-items",
        ),
      ).toBe(true),
    );
    expect(screen.queryByLabelText("현재 사용자 비")).toBeNull();
    expect(
      screen.getByRole("status", { name: "로그인 상태 확인 중" }),
    ).toBeTruthy();

    await act(async () => {
      resolveAddition(
        new Response(
          JSON.stringify({
            items: [
              {
                catalogItemId: 1002,
                categoryId: 10,
                id: 11,
                status: "prev",
                title: "체크리스트 항목 11",
              },
            ],
          }),
          { status: 201 },
        ),
      );
    });

    expect(await screen.findByLabelText("현재 사용자 비")).toBeTruthy();
    expect(await screen.findByText("50%")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/checklists/me"),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "첫 번째 할 일 추가" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "두 번째 할 일 추가" }),
    ).toBeNull();
  });

  it("체크리스트가 없으면 생성한 뒤 준비 항목을 추가한다", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/users/me") {
          return Promise.resolve(
            new Response(JSON.stringify({ nickname: "비비디" }), {
              status: 200,
            }),
          );
        }

        if (url === "/api/catalog") {
          return Promise.resolve(
            new Response(JSON.stringify(preparationCatalogResponseFixture), {
              status: 200,
            }),
          );
        }

        if (url === "/api/checklists/me" && init?.method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                errorCode: 303,
                message: "체크리스트를 찾을 수 없습니다.",
              }),
              { status: 404 },
            ),
          );
        }

        if (url === "/api/checklists" && init?.method === "POST") {
          return Promise.resolve(
            new Response(JSON.stringify(1), { status: 201 }),
          );
        }

        if (
          url === "/api/checklists/me/catalog-items" &&
          init?.method === "POST"
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    catalogItemId: 1001,
                    categoryId: 10,
                    id: 10,
                    status: "prev",
                    title: "체크리스트 항목 10",
                  },
                ],
              }),
              { status: 201 },
            ),
          );
        }

        return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
      });
    vi.stubGlobal("fetch", fetchMock);

    renderServiceLayout(
      <Route path="/preparation" element={<PreparationRoadmapFeature />} />,
      ["/preparation"],
    );

    const addButton = await screen.findByRole("button", {
      name: "첫 번째 할 일 추가",
    });
    fireEvent.click(addButton);

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "첫 번째 할 일 추가" }),
      ).toBeNull(),
    );
    const requestedUrls = fetchMock.mock.calls.map(([url]) => url);
    const createRequestIndex = requestedUrls.indexOf("/api/checklists");
    const addRequestIndex = requestedUrls.indexOf(
      "/api/checklists/me/catalog-items",
    );

    expect(createRequestIndex).toBeGreaterThanOrEqual(0);
    expect(addRequestIndex).toBeGreaterThan(createRequestIndex);
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/checklists/me"),
    ).toHaveLength(1);
  });
});
