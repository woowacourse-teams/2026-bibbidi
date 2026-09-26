import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../features/auth";
import {
  beginAccountSetupProgress,
  clearAccountSetupProgress,
  hasAccountSetupProgress,
} from "../features/account-setup";
import { ChecklistMigrationProvider } from "../features/checklist-migration";
import { preparationCatalogResponseFixture } from "../features/preparation/test/fixtures/preparationCatalogResponse.fixture";
import { installLegacyWebSessionFetch } from "../test/webAuth";
import {
  hasWebAccessToken,
  resetWebAuthSessionForTest,
} from "../infrastructure/auth/webSessionManager";
import { appRoutes } from "./router";

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
  resetWebAuthSessionForTest();
  clearAccountSetupProgress();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn().mockReturnValue(null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  });
});

afterEach(() => {
  resetWebAuthSessionForTest();
  clearAccountSetupProgress();
  vi.unstubAllGlobals();
});

describe("appRoutes", () => {
  it("가입 미완료 사용자가 서비스 경로에 접근하면 온보딩으로 이동한다", async () => {
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
    beginAccountSetupProgress();
    const router = renderRouter(["/checklist"]);

    expect(
      await screen.findByRole("heading", { name: "가입 마무리" }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/onboarding");
    expect(
      fetchMock.mock.calls.some(
        ([input]) => input.toString() === "/api/checklists/me",
      ),
    ).toBe(false);

    fireEvent.click(
      screen.getByRole("button", { name: "다른 계정으로 로그인" }),
    );

    expect(await screen.findByRole("heading", { name: "로그인" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/login");
    expect(hasWebAccessToken()).toBe(false);
    expect(hasAccountSetupProgress()).toBe(false);
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

  it("약관 동의 뒤 계정 선택에서 새 닉네임을 저장하고 홈으로 이동한다", async () => {
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

      if (url === "/api/users/me/nickname") {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 1, nickname: "비비디" }), {
            status: 200,
          }),
        );
      }

      if (url === "/api/users/me") {
        return Promise.resolve(
          new Response(JSON.stringify({ nickname: "비비디" }), {
            status: 200,
          }),
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
    beginAccountSetupProgress();
    const router = renderRouter(["/onboarding"]);

    await screen.findByText("서비스 이용약관");
    fireEvent.click(screen.getByLabelText("전체 동의"));
    fireEvent.click(screen.getByRole("button", { name: "동의하고 계속하기" }));

    expect(
      await screen.findByRole("heading", {
        name: "사용할 계정을 선택해 주세요",
      }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/onboarding/account");

    fireEvent.click(
      screen.getByRole("button", { name: /^새 계정으로 시작하기/ }),
    );
    fireEvent.change(screen.getByLabelText("새 닉네임"), {
      target: { value: "비비디" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "새 계정으로 시작하기" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "로드맵에서 필요한 일만, 내 체크리스트에",
      }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
    expect(hasAccountSetupProgress()).toBe(false);
    expect(
      fetchMock.mock.calls
        .map(([input]) => input.toString())
        .filter((url) =>
          [
            "/api/users/me/terms-agreement",
            "/api/users/me/nickname",
            "/api/users/me",
          ].includes(url),
        ),
    ).toEqual([
      "/api/users/me/terms-agreement",
      "/api/users/me",
      "/api/users/me/nickname",
      "/api/users/me",
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
        await screen.findByRole("heading", { name: "로그인" }),
      ).toBeTruthy();
      expect(router.state.location.pathname).toBe("/login");
    },
  );

  it("가입 완료 사용자가 온보딩에 직접 접근하면 홈으로 이동한다", async () => {
    installFetch(
      new Response(JSON.stringify({ nickname: "bibbidi" }), { status: 200 }),
    );
    const router = renderRouter(["/onboarding"]);

    expect(
      await screen.findByRole("heading", {
        name: "로드맵에서 필요한 일만, 내 체크리스트에",
      }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
  });

  it("진행 표시가 있는 가입 완료 사용자는 계정 선택 주소를 새로 열어도 유지한다", async () => {
    beginAccountSetupProgress();
    installFetch(
      new Response(JSON.stringify({ nickname: "provider-name" }), {
        status: 200,
      }),
    );
    const router = renderRouter(["/onboarding/account"]);

    expect(
      await screen.findByRole("heading", {
        name: "사용할 계정을 선택해 주세요",
      }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/onboarding/account");
  });

  it("진행 표시가 없는 가입 완료 사용자는 계정 선택 주소에서 홈으로 이동한다", async () => {
    installFetch(
      new Response(JSON.stringify({ nickname: "bibbidi" }), { status: 200 }),
    );
    const router = renderRouter(["/onboarding/account"]);

    expect(
      await screen.findByRole("heading", {
        name: "로드맵에서 필요한 일만, 내 체크리스트에",
      }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
  });

  it("약관 미동의 사용자가 계정 선택 주소에 접근하면 약관 단계로 이동한다", async () => {
    beginAccountSetupProgress();
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
    expect(router.state.location.pathname).toBe("/onboarding");
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
        name: "로드맵에서 필요한 일만, 내 체크리스트에",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("main", { name: "준비 목록" })).toBeTruthy();
  });

  it("이전 준비 목록 경로를 루트로 replace 리다이렉트한다", async () => {
    installFetch(
      new Response(
        JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
        { status: 401 },
      ),
    );
    const router = renderRouter(["/login", "/preparation"], 1);

    expect(
      await screen.findByRole("heading", {
        name: "로드맵에서 필요한 일만, 내 체크리스트에",
      }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");

    await act(async () => router.navigate(-1));

    expect(await screen.findByRole("heading", { name: "로그인" })).toBeTruthy();
  });

  it("알 수 없는 경로를 루트로 이동시킨다", async () => {
    installFetch(
      new Response(
        JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
        { status: 401 },
      ),
    );
    const router = renderRouter(["/unknown"]);

    expect(
      await screen.findByRole("heading", {
        name: "로드맵에서 필요한 일만, 내 체크리스트에",
      }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
  });

  it("인증 사용자가 플래너에서 기존 일정 대시보드를 본다", async () => {
    installFetch(
      new Response(JSON.stringify({ nickname: "bibbidi" }), { status: 200 }),
    );
    renderRouter(["/planner"]);

    expect(
      await screen.findByRole("heading", { name: "가까운 일정" }),
    ).toBeTruthy();
    expect(screen.getByRole("main", { name: "플래너" })).toBeTruthy();
    expect(await screen.findByText("예정된 일정이 없어요")).toBeTruthy();
  });

  it("플래너 조회 중 로그인 세션이 사라지면 로그인 화면으로 이동한다", async () => {
    let currentUserRequestCount = 0;
    installLegacyWebSessionFetch(
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/users/me") {
          currentUserRequestCount += 1;

          return Promise.resolve(
            currentUserRequestCount === 1
              ? new Response(JSON.stringify({ nickname: "bibbidi" }), {
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

        if (url === "/api/appointments/me/nearby?limit=6") {
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
    const router = renderRouter(["/planner"]);

    expect(await screen.findByRole("heading", { name: "로그인" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe("?returnTo=%2Fplanner");
    expect(currentUserRequestCount).toBe(2);
  });
});
