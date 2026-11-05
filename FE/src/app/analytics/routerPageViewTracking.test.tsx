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
import {
  createRouterPageViewTrackingState,
  startRouterPageViewTracking,
  trackPageView,
  type RouterPageViewTrackingState,
} from "./routerPageViewTracking";

const routes: RouteObject[] = [
  { path: "/", element: <h1>준비 목록</h1> },
  { path: "/calendar", element: <h1>캘린더</h1> },
  { path: "/checklist", element: <h1>체크리스트</h1> },
  { path: "/login", element: <h1>로그인</h1> },
  { path: "/signup", element: <Navigate replace to="/login" /> },
  { path: "/preparation", element: <h1>준비 목록</h1> },
  { path: "*", element: <Navigate replace to="/" /> },
];

function createAnalyticsMock(): AnalyticsClient {
  return {
    initialize: vi.fn(),
    setContext: vi.fn(),
    reset: vi.fn(),
    track: vi.fn(),
  };
}

function renderTrackedRouter(
  initialEntries: string[],
  initialIndex?: number,
  trackingState?: RouterPageViewTrackingState,
) {
  const router = createMemoryRouter(routes, { initialEntries, initialIndex });
  const analytics = createAnalyticsMock();
  const unsubscribe = startRouterPageViewTracking(
    router,
    analytics,
    "https://bibbidi.example",
    trackingState,
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
    const { analytics, router } = renderTrackedRouter(["/", "/calendar"], 0);

    await act(async () => router.navigate("/calendar"));
    await act(async () => router.navigate(-1));
    await act(async () => router.navigate(1));

    expect(analytics.track).toHaveBeenCalledTimes(4);
    expect(
      vi
        .mocked(analytics.track)
        .mock.calls.map(([event]) => event.parameters.page_path),
    ).toEqual(["/", "/calendar", "/", "/calendar"]);
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

  it("준비 목록 경로를 별도 화면으로 측정한다", () => {
    const { analytics, router } = renderTrackedRouter(["/preparation"]);

    expect(router.state.location.pathname).toBe("/preparation");
    expect(analytics.track).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        parameters: expect.objectContaining({ page_path: "/preparation" }),
      }),
    );
  });

  it.each(["/unknown?taskId=secret"])(
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
      router.navigate("/checklist?taskId=item-99&returnTo=%2Fcalendar", {
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

  it("UTM 링크로 들어오면 첫 페이지뷰에만 원래 쿼리와 외부 referrer를 붙인다", async () => {
    const utmQuery =
      "?utm_source=threads&utm_medium=social&utm_campaign=bibbidi_promo&utm_content=post_02";
    const { analytics, router } = renderTrackedRouter(
      [`/${utmQuery}`],
      undefined,
      createRouterPageViewTrackingState({
        pathname: "/",
        search: utmQuery,
        referrer: "https://www.threads.com/",
      }),
    );

    await act(async () => router.navigate("/calendar"));

    expect(
      vi
        .mocked(analytics.track)
        .mock.calls.map(([event]) => [
          event.parameters.page_location,
          event.parameters.page_referrer,
        ]),
    ).toEqual([
      [`https://bibbidi.example/${utmQuery}`, "https://www.threads.com/"],
      ["https://bibbidi.example/calendar", "https://bibbidi.example/"],
    ]);
  });

  it("소셜 로그인 콜백으로 들어오면 code·state와 제공자 referrer를 보내지 않는다", () => {
    const { analytics } = renderTrackedRouter(
      ["/"],
      undefined,
      createRouterPageViewTrackingState({
        pathname: "/auth/kakao",
        search: "?code=authorization-code&state=login-state",
        referrer: "https://kauth.kakao.com/",
      }),
    );

    expect(analytics.track).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        parameters: expect.objectContaining({
          page_location: "https://bibbidi.example/",
          page_referrer: "",
        }),
      }),
    );
  });

  it("로그인 사용자가 바뀌어 다시 측정해도 첫 진입 정보는 다시 붙이지 않는다", () => {
    const analytics = createAnalyticsMock();
    const trackingState = createRouterPageViewTrackingState({
      pathname: "/",
      search: "?utm_source=instagram",
      referrer: "https://l.instagram.com/",
    });

    trackPageView("/", analytics, "https://bibbidi.example", trackingState);
    trackingState.lastTrackedPagePath = null;
    trackPageView("/", analytics, "https://bibbidi.example", trackingState);

    expect(vi.mocked(analytics.track).mock.lastCall?.[0].parameters).toEqual(
      expect.objectContaining({
        page_location: "https://bibbidi.example/",
        page_referrer: "",
      }),
    );
  });

  it("Analytics 오류를 라우터 이동에서 격리한다", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    const analytics: AnalyticsClient = {
      initialize: vi.fn(),
      setContext: vi.fn(),
      reset: vi.fn(),
      track: vi.fn(() => {
        throw new Error("Analytics 전송 실패");
      }),
    };

    expect(() =>
      startRouterPageViewTracking(router, analytics, "https://bibbidi.example"),
    ).not.toThrow();
    render(<RouterProvider router={router} />);

    await expect(
      act(async () => router.navigate("/calendar")),
    ).resolves.toBeUndefined();
    expect(screen.getByRole("heading", { name: "캘린더" })).toBeTruthy();
  });

  it("구독 해제 뒤에는 페이지뷰를 보내지 않는다", async () => {
    const { analytics, router, unsubscribe } = renderTrackedRouter(["/"]);

    unsubscribe();
    await act(async () => router.navigate("/calendar"));

    expect(analytics.track).toHaveBeenCalledOnce();
  });
});
