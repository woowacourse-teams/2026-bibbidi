import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../features/auth";
import { ChecklistMigrationProvider } from "../features/checklist-migration";
import { preparationCatalogResponseFixture } from "../features/preparation/test/fixtures/preparationCatalogResponse.fixture";
import { appRoutes } from "./router";

function installFetch(currentUserResponse: Response) {
  vi.stubGlobal(
    "fetch",
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
  vi.stubGlobal("localStorage", {
    getItem: vi.fn().mockReturnValue(null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("appRoutes", () => {
  it("루트에서 준비 목록을 표시한다", async () => {
    installFetch(
      new Response(
        JSON.stringify({ errorCode: 201, message: "로그인이 필요합니다." }),
        { status: 401 },
      ),
    );
    renderRouter(["/"]);

    expect(
      await screen.findByRole("heading", { name: "준비 로드맵" }),
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
      await screen.findByRole("heading", { name: "준비 로드맵" }),
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
      await screen.findByRole("heading", { name: "준비 로드맵" }),
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
    vi.stubGlobal(
      "fetch",
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
