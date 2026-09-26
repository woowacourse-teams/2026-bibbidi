import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import {
  createMemoryRouter,
  Navigate,
  RouterProvider,
  type RouteObject,
} from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { AnalyticsClient } from "../../infrastructure/analytics";
import { startRouterPageViewTracking } from "./routerPageViewTracking";

const routes: RouteObject[] = [
  { path: "/", element: <h1>준비 목록</h1> },
  { path: "/planner", element: <h1>플래너</h1> },
  { path: "/checklist", element: <h1>체크리스트</h1> },
  { path: "/login", element: <h1>로그인</h1> },
  { path: "/signup", element: <Navigate replace to="/login" /> },
  { path: "/preparation", element: <Navigate replace to="/" /> },
  { path: "*", element: <Navigate replace to="/" /> },
];

function createAnalyticsMock(): AnalyticsClient {
  return {
    initialize: vi.fn(),
    track: vi.fn(),
  };
}

function renderTrackedRouter(initialEntries: string[], initialIndex?: number) {
  const router = createMemoryRouter(routes, { initialEntries, initialIndex });
  const analytics = createAnalyticsMock();
  const unsubscribe = startRouterPageViewTracking(
    router,
    analytics,
    "https://bibbidi.example",
  );

  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );

  return { analytics, router, unsubscribe };
}

describe("startRouterPageViewTracking", () => {
  it("StrictMode 최초 진입에서도 페이지뷰를 한 번만 보낸다", () => {
    const { analytics } = renderTrackedRouter(["/"]);

    expect(analytics.track).toHaveBeenCalledOnce();
    expect(analytics.track).toHaveBeenCalledWith({
      name: "page_view",
      parameters: {
        page_location: "https://bibbidi.example/",
        page_path: "/",
        page_referrer: "",
        page_title: "준비 목록",
        screen_name: "preparation_catalog",
      },
    });
  });

  it("SPA 이동과 뒤로 가기 및 앞으로 가기를 각각 측정한다", async () => {
    const { analytics, router } = renderTrackedRouter(["/", "/planner"], 0);

    await act(async () => router.navigate("/planner"));
    await act(async () => router.navigate(-1));
    await act(async () => router.navigate(1));

    expect(analytics.track).toHaveBeenCalledTimes(4);
    expect(
      vi
        .mocked(analytics.track)
        .mock.calls.map(([event]) => event.parameters.page_path),
    ).toEqual(["/", "/planner", "/", "/planner"]);
  });

  it("회원가입 주소는 로그인 화면으로 이동한 뒤 로그인만 측정한다", async () => {
    const { analytics, router } = renderTrackedRouter(["/signup"]);

    expect(await screen.findByRole("heading", { name: "로그인" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/login");
    expect(analytics.track).toHaveBeenCalledOnce();
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

  it.each(["/preparation", "/unknown?taskId=secret"])(
    "리다이렉트 경로 %s 대신 최종 루트 화면만 측정한다",
    async (initialEntry) => {
      const { analytics, router } = renderTrackedRouter([initialEntry]);

      expect(
        await screen.findByRole("heading", { name: "준비 목록" }),
      ).toBeTruthy();
      expect(router.state.location.pathname).toBe("/");
      expect(analytics.track).toHaveBeenCalledOnce();
      expect(analytics.track).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({ page_path: "/" }),
        }),
      );
    },
  );

  it("쿼리와 식별자를 버리고 같은 화면의 쿼리 변경은 중복 측정하지 않는다", async () => {
    const { analytics, router } = renderTrackedRouter([
      "/checklist?taskId=item-42&addAppointment=사용자입력&addTask=1",
    ]);

    await act(async () =>
      router.navigate("/checklist?taskId=item-99&returnTo=%2Fplanner", {
        replace: true,
      }),
    );

    expect(analytics.track).toHaveBeenCalledOnce();
    expect(analytics.track).toHaveBeenCalledWith({
      name: "page_view",
      parameters: {
        page_location: "https://bibbidi.example/checklist",
        page_path: "/checklist",
        page_referrer: "",
        page_title: "체크리스트",
        screen_name: "checklist",
      },
    });
  });

  it("Analytics 오류를 라우터 이동에서 격리한다", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    const analytics: AnalyticsClient = {
      initialize: vi.fn(),
      track: vi.fn(() => {
        throw new Error("Analytics 전송 실패");
      }),
    };

    expect(() =>
      startRouterPageViewTracking(router, analytics, "https://bibbidi.example"),
    ).not.toThrow();
    render(<RouterProvider router={router} />);

    await expect(
      act(async () => router.navigate("/planner")),
    ).resolves.toBeUndefined();
    expect(screen.getByRole("heading", { name: "플래너" })).toBeTruthy();
  });

  it("구독 해제 뒤에는 페이지뷰를 보내지 않는다", async () => {
    const { analytics, router, unsubscribe } = renderTrackedRouter(["/"]);

    unsubscribe();
    await act(async () => router.navigate("/planner"));

    expect(analytics.track).toHaveBeenCalledOnce();
  });
});
