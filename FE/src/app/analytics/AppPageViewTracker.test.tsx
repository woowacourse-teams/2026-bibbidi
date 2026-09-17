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
  it("보호 경로의 인증 리다이렉트가 끝난 로그인 화면만 측정한다", async () => {
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

    expect(await screen.findByRole("heading", { name: "로그인" })).toBeTruthy();
    await waitFor(() => expect(analytics.track).toHaveBeenCalledOnce());
    expect(analytics.track).toHaveBeenCalledWith({
      name: "page_view",
      parameters: {
        page_location: "https://bibbidi.example/login",
        page_path: "/login",
        page_referrer: "",
        page_title: "로그인",
        screen_name: "login",
      },
    });
  });
});
