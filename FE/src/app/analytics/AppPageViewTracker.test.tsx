import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../../features/auth";
import { ChecklistMigrationProvider } from "../../features/checklist-migration";
import type { AnalyticsClient } from "../../infrastructure/analytics";
import { resolveHomeEntryVariant } from "../../infrastructure/analytics";
import { appRoutes } from "../router";
import { AppPageViewTracker } from "./AppPageViewTracker";

vi.mock("../../infrastructure/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../infrastructure/analytics")>()),
  resolveHomeEntryVariant: vi.fn().mockResolvedValue("control"),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppPageViewTracker", () => {
  it.each([
    ["control", "/", "준비 목록"],
    ["test", "/calendar", "캘린더"],
  ] as const)(
    "%s 실험군은 실제 첫 화면 %s만 측정한다",
    async (variant, expectedPath, expectedScreen) => {
      vi.mocked(resolveHomeEntryVariant).mockResolvedValue(variant);
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
      const router = createMemoryRouter(appRoutes, { initialEntries: ["/"] });

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
        await screen.findByRole("main", { name: expectedScreen }),
      ).toBeTruthy();
      await waitFor(() => expect(analytics.track).toHaveBeenCalledOnce());
      expect(analytics.track).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({ page_path: expectedPath }),
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
