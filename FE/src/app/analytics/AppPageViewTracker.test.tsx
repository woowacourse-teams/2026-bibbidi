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
  it("비로그인 사용자도 플래너 화면을 한 번만 측정한다", async () => {
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
      initialEntries: ["/planner?taskId=private"],
    });

    render(
      <StrictMode>
        <AuthProvider>
          <ChecklistMigrationProvider>
            <RouterProvider router={router} />
            <AppPageViewTracker
              analytics={analytics}
              origin="https://bibbidi.example"
              router={router}
            />
          </ChecklistMigrationProvider>
        </AuthProvider>
      </StrictMode>,
    );

    expect(await screen.findByRole("heading", { name: "캘린더" })).toBeTruthy();
    await waitFor(() => expect(analytics.track).toHaveBeenCalledOnce());
    expect(analytics.track).toHaveBeenCalledWith({
      name: "page_view",
      parameters: {
        page_location: "https://bibbidi.example/planner",
        page_path: "/planner",
        page_referrer: "",
        page_title: "플래너",
        screen_name: "planner",
      },
    });
  });
});
