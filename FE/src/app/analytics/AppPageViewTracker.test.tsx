import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../../features/auth";
import { ChecklistMigrationProvider } from "../../features/checklist-migration";
import type { AnalyticsClient } from "../../infrastructure/analytics";
import { appRoutes } from "../router";
import { AppPageViewTracker } from "./AppPageViewTracker";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppPageViewTracker", () => {
  it.each(["/", "/?categoryId=10"])(
    "%s 진입에서 준비 목록의 페이지 조회를 한 번만 측정한다",
    async (entry) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                errorCode: 201,
                message: "로그인이 필요합니다.",
              }),
              { status: 401 },
            ),
          ),
        ),
      );
      const analytics: AnalyticsClient = {
        initialize: vi.fn(),
        setContext: vi.fn(),
        reset: vi.fn(),
        track: vi.fn(),
      };
      const router = createMemoryRouter(appRoutes, { initialEntries: [entry] });

      render(
        <StrictMode>
          <AuthProvider>
            <ChecklistMigrationProvider>
              <AppPageViewTracker
                analytics={analytics}
                origin="https://bibbidi.example"
                router={router}
              >
                <RouterProvider router={router} />
              </AppPageViewTracker>
            </ChecklistMigrationProvider>
          </AuthProvider>
        </StrictMode>,
      );

      expect(
        await screen.findByRole("main", { name: "준비 목록" }),
      ).toBeTruthy();
      await waitFor(() => expect(analytics.track).toHaveBeenCalledOnce());
      expect(analytics.track).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "page_view",
          parameters: expect.objectContaining({ page_path: "/" }),
        }),
      );
    },
  );

  it("비로그인 사용자도 캘린더 화면을 한 번만 측정한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              errorCode: 201,
              message: "로그인이 필요합니다.",
            }),
            { status: 401 },
          ),
        ),
      ),
    );
    const analytics: AnalyticsClient = {
      initialize: vi.fn(),
      setContext: vi.fn(),
      reset: vi.fn(),
      track: vi.fn(),
    };
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ["/calendar?taskId=private"],
    });

    render(
      <StrictMode>
        <AuthProvider>
          <ChecklistMigrationProvider>
            <AppPageViewTracker
              analytics={analytics}
              origin="https://bibbidi.example"
              router={router}
            >
              <RouterProvider router={router} />
            </AppPageViewTracker>
          </ChecklistMigrationProvider>
        </AuthProvider>
      </StrictMode>,
    );

    expect(
      await screen.findByRole("heading", { name: "내 준비 일정" }),
    ).toBeTruthy();
    await waitFor(() => expect(analytics.track).toHaveBeenCalledOnce());
    expect(analytics.track).toHaveBeenCalledWith({
      name: "page_view",
      parameters: {
        page_location: "https://bibbidi.example/calendar",
        page_path: "/calendar",
        page_referrer: "",
        page_title: "캘린더",
        screen_name: "calendar",
      },
    });
  });
});
