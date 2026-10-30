import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../features/auth";
import { ChecklistMigrationProvider } from "../features/checklist-migration";
import {
  questions,
  wireQuestions,
  result,
} from "../features/balance-game/test/fixtures";
import { preparationCatalogResponseFixture } from "../features/preparation/test/fixtures/preparationCatalogResponse.fixture";
import { installLegacyWebSessionFetch } from "../test/webAuth";
import { installMatchMedia } from "../test/matchMedia";
import { MOBILE_LAYOUT_MEDIA_QUERY } from "../shared/responsive";
import { resolveHomeEntryVariant } from "../infrastructure/analytics";
import {
  hasWebAccessToken,
  resetWebAuthSessionForTest,
} from "../infrastructure/auth/webSessionManager";
import { appRoutes } from "./router";

vi.mock("../infrastructure/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../infrastructure/analytics")>()),
  resolveHomeEntryVariant: vi.fn().mockResolvedValue("control"),
}));

function installFetch(currentUserResponse: Response) {
  installLegacyWebSessionFetch(
    vi.fn().mockImplementation((url: string) => {
      if (url === "/api/users/me") {
        return Promise.resolve(currentUserResponse.clone());
      }

      if (url === "/api/catalog") {
        return Promise.resolve(
          new Response(JSON.stringify(preparationCatalogResponseFixture), {
            status: 200,
          }),
        );
      }

      if (url === "/api/balance-game/questions") {
        return Promise.resolve(new Response(JSON.stringify(wireQuestions)));
      }

      if (url === "/api/balance-game/results") {
        return Promise.resolve(
          new Response(
            JSON.stringify({ ...result, catalogItemIds: [1001, 1002] }),
          ),
        );
      }

      if (url === "/api/checklists/me") {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, items: [] }), { status: 200 }),
        );
      }

      if (url === "/api/users/me/wedding-date") {
        return Promise.resolve(
          new Response(JSON.stringify({ weddingDate: null }), { status: 200 }),
        );
      }

      if (url === "/api/appointments/me/nearby?limit=6") {
        return Promise.resolve(
          new Response(JSON.stringify([]), { status: 200 }),
        );
      }

      return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
    }),
  );
}

function renderRouter(initialEntries: string[], initialIndex?: number) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries,
    initialIndex,
  });

  render(
    <AuthProvider>
      <ChecklistMigrationProvider>
        <RouterProvider router={router} />
      </ChecklistMigrationProvider>
    </AuthProvider>,
  );

  return router;
}

beforeEach(() => {
  vi.mocked(resolveHomeEntryVariant).mockReset().mockResolvedValue("control");
  resetWebAuthSessionForTest();
  sessionStorage.clear();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn().mockReturnValue(null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  });
});

afterEach(() => {
  resetWebAuthSessionForTest();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("appRoutes", () => {
  it("비로그인으로 게임·카드를 보고 저장할 때 로그인 복귀 주소를 유지한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    installFetch(
      new Response(
        JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
        { status: 401 },
      ),
    );
    const router = renderRouter(["/balance-game"]);

    await screen.findByRole("heading", { name: questions[0].question });
    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("link", { name: "비비디 홈" }),
    ).toBeTruthy();
    expect(within(header).getByRole("link", { name: "로그인" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "하단 메뉴" })).toBeNull();
    expect(screen.queryByRole("button", { name: "AI" })).toBeNull();
    expect(
      screen
        .getByRole("region", { name: "서비스 화면" })
        .hasAttribute("data-navigation-dock"),
    ).toBe(false);

    fireEvent.click(
      screen.getByRole("button", { name: questions[0].options[0].text }),
    );
    fireEvent.click(screen.getByRole("button", { name: "아직 잘 모르겠어" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "로그인하고 2개 할 일 담기" }),
    );
    await screen.findByRole("region", { name: "소셜 로그인" });
    expect(router.state.location.pathname).toBe("/balance-game");
    expect(router.state.location.search).toBe("");
    expect(router.state.location.state.loginModal.returnTo).toBe(
      "/balance-game",
    );
  });

  it.each([false, true])(
    "밸런스게임 질문과 결과에 공통 헤더를 유지하고 로드맵으로 이동한다 (모바일: %s)",
    async (isMobile) => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, isMobile);
      installFetch(new Response(JSON.stringify({ id: 1, nickname: "비비디" })));
      const router = renderRouter(["/balance-game"]);

      await screen.findByRole("heading", { name: questions[0].question });
      const header = screen.getByRole("banner");
      expect(
        within(header).getByRole("button", { name: "계정 메뉴" }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("navigation", { name: "하단 메뉴" }),
      ).toBeNull();
      expect(document.querySelectorAll(".bibbidi-app-layout")).toHaveLength(1);
      fireEvent.click(
        screen.getByRole("button", { name: questions[0].options[0].text }),
      );
      fireEvent.click(screen.getByRole("button", { name: "아직 잘 모르겠어" }));

      await screen.findByRole("heading", { name: /우리에게 맞는/ });
      expect(screen.getByRole("banner")).toBe(header);
      fireEvent.click(
        within(header).getByRole("button", { name: "계정 메뉴" }),
      );
      expect(screen.getByRole("button", { name: "로그아웃" })).toBeTruthy();
      fireEvent.click(
        within(header).getByRole("button", { name: "계정 메뉴" }),
      );
      fireEvent.click(within(header).getByRole("link", { name: "로드맵" }));

      await screen.findByRole("main", { name: "준비 목록" });
      expect(router.state.location.pathname).toBe("/preparation");
      expect(
        screen.getByRole("navigation", { name: "하단 메뉴" }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("link", { name: /밸런스게임 시작하기/ }),
      ).toBeNull();
    },
  );

  it.each([401, 200])(
    "인증 응답 %s에서도 랜딩을 독립 화면으로 표시하고 시작 버튼을 준비 목록으로 연결한다",
    async (status) => {
      installFetch(
        new Response(
          JSON.stringify(
            status === 200
              ? { id: 1, nickname: "bibbidi" }
              : { errorCode: 201, message: "로그인이 필요합니다." },
          ),
          { status },
        ),
      );
      const router = renderRouter(["/landing"]);
      expect(
        await screen.findByRole("main", { name: "비비디 서비스 소개" }),
      ).toBeTruthy();
      expect(router.state.location.pathname).toBe("/landing");
      expect(
        screen.queryByRole("navigation", { name: "주요 메뉴" }),
      ).toBeNull();
      fireEvent.click(
        screen.getAllByRole("link", { name: /준비 시작하기/ })[0],
      );
      expect(
        await screen.findByRole("main", { name: "준비 목록" }),
      ).toBeTruthy();
      expect(router.state.location.pathname).toBe("/preparation");
    },
  );

  it("회원가입 주소는 홈 위에 로그인 모달을 연다", async () => {
    installFetch(
      new Response(
        JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
        { status: 401 },
      ),
    );
    const router = renderRouter(["/signup"]);

    expect(
      await screen.findByRole("region", { name: "소셜 로그인" }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
  });

  it("가입 미완료 사용자는 현재 화면에서 약관 모달을 열고 개인 API를 호출하지 않는다", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();

      if (url === "/api/auth/web/sessions/refresh") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              accessToken: "pending-token",
              termsAgreementRequired: true,
            }),
            { status: 200 },
          ),
        );
      }

      if (url === "/api/terms") {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 1,
                code: "service",
                version: "2026-09",
                title: "서비스 이용약관",
                content: "서비스 이용약관 전문",
                required: true,
              },
            ]),
            { status: 200 },
          ),
        );
      }

      if (url === "/api/auth/web/sessions/current") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const router = renderRouter(["/checklist"]);

    expect(
      await screen.findByRole("heading", { name: "가입 마무리" }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/checklist");
    expect(
      fetchMock.mock.calls.some(
        ([input]) => input.toString() === "/api/checklists/me",
      ),
    ).toBe(false);

    fireEvent.click(
      screen.getByRole("button", { name: "다른 계정으로 로그인" }),
    );

    expect(
      await screen.findByRole("region", { name: "소셜 로그인" }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/checklist");
    expect(hasWebAccessToken()).toBe(false);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/web/sessions/current",
        expect.objectContaining({
          credentials: "include",
          method: "DELETE",
        }),
      ),
    );
  });

  it("약관 동의 뒤 새 계정 체크리스트를 만들고 홈으로 이동한다", async () => {
    let hasChecklist = false;
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();

      if (url === "/api/auth/web/sessions/refresh") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              accessToken: "pending-token",
              termsAgreementRequired: true,
            }),
            { status: 200 },
          ),
        );
      }

      if (url === "/api/terms") {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 1,
                code: "service",
                version: "2026-09",
                title: "서비스 이용약관",
                content: "서비스 이용약관 전문",
                required: true,
              },
            ]),
            { status: 200 },
          ),
        );
      }

      if (url === "/api/users/me/terms-agreement") {
        return Promise.resolve(
          new Response(JSON.stringify({ accessToken: "active-token" }), {
            status: 200,
          }),
        );
      }

      if (url === "/api/users/me") {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, nickname: "비비디" }), {
            status: 200,
          }),
        );
      }

      if (url === "/api/checklists/me") {
        if (!hasChecklist) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                errorCode: 303,
                message: "체크리스트가 없습니다.",
              }),
              { status: 404 },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, items: [] }), { status: 200 }),
        );
      }

      if (url === "/api/checklists") {
        hasChecklist = true;
        return Promise.resolve(
          new Response(JSON.stringify(1), { status: 201 }),
        );
      }

      if (url === "/api/users/me/wedding-date") {
        return Promise.resolve(
          new Response(JSON.stringify({ weddingDate: null }), { status: 200 }),
        );
      }

      if (url === "/api/catalog") {
        return Promise.resolve(
          new Response(JSON.stringify(preparationCatalogResponseFixture), {
            status: 200,
          }),
        );
      }

      if (url === "/api/appointments/me/nearby?limit=6") {
        return Promise.resolve(
          new Response(JSON.stringify([]), { status: 200 }),
        );
      }

      return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const router = renderRouter(["/onboarding"]);

    await screen.findByText("서비스 이용약관");
    fireEvent.click(screen.getByLabelText("전체 동의"));
    fireEvent.click(screen.getByRole("button", { name: "동의하고 계속하기" }));

    expect(
      await screen.findByRole("heading", {
        name: "첫 번째 카테고리",
      }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
    expect(
      fetchMock.mock.calls
        .map(([input]) => input.toString())
        .filter((url) =>
          [
            "/api/users/me/terms-agreement",
            "/api/users/me",
            "/api/checklists",
          ].includes(url),
        ),
    ).toEqual([
      "/api/users/me/terms-agreement",
      "/api/users/me",
      "/api/checklists",
    ]);
  });

  it.each(["/onboarding", "/onboarding/account"])(
    "비로그인 사용자가 %s에 직접 접근하면 로그인으로 이동한다",
    async (path) => {
      installFetch(
        new Response(
          JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
          { status: 401 },
        ),
      );
      const router = renderRouter([path]);

      expect(
        await screen.findByRole("region", { name: "소셜 로그인" }),
      ).toBeTruthy();
      expect(router.state.location.pathname).toBe("/");
    },
  );

  it("가입 완료 사용자가 온보딩에 직접 접근하면 홈으로 이동한다", async () => {
    installFetch(
      new Response(JSON.stringify({ id: 1, nickname: "bibbidi" }), {
        status: 200,
      }),
    );
    const router = renderRouter(["/onboarding"]);

    expect(
      await screen.findByRole("heading", {
        name: "첫 번째 카테고리",
      }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
  });

  it.each([false, true])(
    "이전 계정 선택 기록 존재 여부(%s)와 관계없이 삭제된 주소에서 홈으로 이동한다",
    async (hasLegacyProgress) => {
      if (hasLegacyProgress) {
        sessionStorage.setItem("bibbidi.account-setup.pending", "true");
        sessionStorage.setItem("bibbidi.account-setup.choice", "legacy");
      }
      installFetch(
        new Response(JSON.stringify({ id: 1, nickname: "bibbidi" }), {
          status: 200,
        }),
      );
      const router = renderRouter(["/onboarding/account"]);

      expect(
        await screen.findByRole("heading", {
          name: "첫 번째 카테고리",
        }),
      ).toBeTruthy();
      expect(router.state.location.pathname).toBe("/");
    },
  );

  it("약관 미동의 사용자가 계정 선택 주소에 접근하면 약관 단계로 이동한다", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();

      if (url === "/api/auth/web/sessions/refresh") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              accessToken: "pending-token",
              termsAgreementRequired: true,
            }),
            { status: 200 },
          ),
        );
      }

      if (url === "/api/terms") {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 1,
                code: "service",
                version: "2026-09",
                title: "서비스 이용약관",
                content: "서비스 이용약관 전문",
                required: true,
              },
            ]),
            { status: 200 },
          ),
        );
      }

      return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const router = renderRouter(["/onboarding/account"]);

    expect(
      await screen.findByRole("heading", { name: "가입 마무리" }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
  });

  it("루트에서 준비 목록을 표시한다", async () => {
    installFetch(
      new Response(
        JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
        { status: 401 },
      ),
    );
    renderRouter(["/"]);

    expect(
      await screen.findByRole("heading", {
        name: "첫 번째 카테고리",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("main", { name: "준비 목록" })).toBeTruthy();
  });

  it("실험군은 루트에서 캘린더로 이동하고 로드맵에 접근할 수 있다", async () => {
    vi.mocked(resolveHomeEntryVariant).mockResolvedValue("test");
    installFetch(
      new Response(
        JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
        { status: 401 },
      ),
    );
    const router = renderRouter(["/"]);

    expect(await screen.findByRole("main", { name: "캘린더" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/calendar");
    expect(screen.queryByRole("main", { name: "준비 목록" })).toBeNull();

    fireEvent.click(screen.getAllByRole("link", { name: "로드맵" })[0]);
    expect(await screen.findByRole("main", { name: "준비 목록" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/preparation");
  });

  it("카테고리로 연결된 루트 주소는 실험군이어도 준비 목록을 연다", async () => {
    vi.mocked(resolveHomeEntryVariant).mockResolvedValue("test");
    installFetch(
      new Response(
        JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
        { status: 401 },
      ),
    );
    const router = renderRouter(["/?categoryId=1"]);

    expect(await screen.findByRole("main", { name: "준비 목록" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
    expect(vi.mocked(resolveHomeEntryVariant)).not.toHaveBeenCalled();
  });

  it("준비 목록 경로는 첫 화면 실험과 별개로 로드맵을 보여준다", async () => {
    installFetch(
      new Response(
        JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
        { status: 401 },
      ),
    );
    const router = renderRouter(["/login", "/preparation"], 1);

    expect(
      await screen.findByRole("heading", {
        name: "첫 번째 카테고리",
      }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/preparation");

    await act(async () => router.navigate(-1));

    expect(
      await screen.findByRole("region", { name: "소셜 로그인" }),
    ).toBeTruthy();
  });

  it.each(["/unknown", "/planner"])(
    "지원하지 않는 경로 %s를 루트로 이동시킨다",
    async (initialEntry) => {
      installFetch(
        new Response(
          JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
          { status: 401 },
        ),
      );
      const router = renderRouter([initialEntry]);

      expect(
        await screen.findByRole("heading", {
          name: "첫 번째 카테고리",
        }),
      ).toBeTruthy();
      expect(router.state.location.pathname).toBe("/");
    },
  );

  it("인증 사용자가 캘린더에서 월간 캘린더를 본다", async () => {
    installFetch(
      new Response(JSON.stringify({ id: 1, nickname: "bibbidi" }), {
        status: 200,
      }),
    );
    renderRouter(["/calendar"]);

    expect(
      await screen.findByRole("heading", { name: "내 준비 일정" }),
    ).toBeTruthy();
    expect(screen.getByRole("main", { name: "캘린더" })).toBeTruthy();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([input]) =>
            input.toString() === "/api/appointments/me/nearby?limit=6",
        ),
    ).toBe(false);
  });

  it("비로그인 사용자가 캘린더에 직접 접근하고 개인화 API는 호출하지 않는다", async () => {
    installFetch(
      new Response(
        JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
        { status: 401 },
      ),
    );
    const router = renderRouter(["/calendar"]);

    expect(
      await screen.findByRole("heading", { name: "내 준비 일정" }),
    ).toBeTruthy();
    expect(
      await screen.findByText(/로그인하면 담은 할 일에 날짜를 정하고/),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/calendar");
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([input]) =>
          [
            "/api/appointments/me/nearby?limit=6",
            "/api/checklists/me/unscheduled-items?limit=2",
            "/api/checklists/me/recommended-catalog-items?limit=4",
          ].includes(input.toString()),
        ),
    ).toBe(false);
  });

  it("캘린더 조회 중 로그인 세션이 사라지면 현재 페이지의 비로그인 안내로 전환한다", async () => {
    let currentUserRequestCount = 0;
    installLegacyWebSessionFetch(
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/users/me") {
          currentUserRequestCount += 1;

          return Promise.resolve(
            currentUserRequestCount === 1
              ? new Response(JSON.stringify({ id: 1, nickname: "bibbidi" }), {
                  status: 200,
                })
              : new Response(
                  JSON.stringify({
                    errorCode: 201,
                    message: "로그인이 필요합니다.",
                  }),
                  { status: 401 },
                ),
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
            new Response(JSON.stringify({ id: 1, items: [] }), {
              status: 200,
            }),
          );
        }

        if (url === "/api/checklists/me/recommended-catalog-items?limit=2") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                errorCode: 201,
                message: "로그인이 필요합니다.",
              }),
              { status: 401 },
            ),
          );
        }

        return Promise.reject(new Error(`예상하지 못한 요청: ${url}`));
      }),
    );
    const router = renderRouter(["/calendar"]);

    expect(
      await screen.findByRole("heading", { name: "내 준비 일정" }),
    ).toBeTruthy();
    await waitFor(() => expect(currentUserRequestCount).toBe(2));
    expect(
      await screen.findByText(/로그인하면 담은 할 일에 날짜를 정하고/),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/calendar");
    expect(router.state.location.search).toBe("");
  });
});
