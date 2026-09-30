import type { AnalyticsClient } from "../../infrastructure/analytics";
import {
  createPageViewEvent,
  normalizePagePath,
  type LandingPage,
  type PagePath,
} from "./pageView";

export interface RouterStateSnapshot {
  initialized: boolean;
  location: {
    pathname: string;
  };
  navigation: {
    state: string;
  };
}

export interface SubscribableRouter {
  state: RouterStateSnapshot;
  subscribe: (subscriber: (state: RouterStateSnapshot) => void) => () => void;
}

export interface RouterPageViewTrackingState {
  lastTrackedPagePath: PagePath | null;
  landingPage: LandingPage | null;
}

export function createRouterPageViewTrackingState(
  landingPage?: LandingPage,
): RouterPageViewTrackingState {
  // 소셜 로그인 콜백처럼 측정하지 않는 주소로 들어오면 code·state와 제공자 referrer를 보내지 않는다.
  const isTrackedLanding =
    landingPage !== undefined &&
    normalizePagePath(landingPage.pathname) !== null;

  return {
    lastTrackedPagePath: null,
    landingPage: isTrackedLanding ? landingPage : null,
  };
}

export function trackPageView(
  pagePath: PagePath,
  analytics: AnalyticsClient,
  origin: string,
  trackingState: RouterPageViewTrackingState,
) {
  if (pagePath === trackingState.lastTrackedPagePath) return;

  const referrerPath = trackingState.lastTrackedPagePath;
  const landingPage = trackingState.landingPage;
  trackingState.lastTrackedPagePath = pagePath;
  // 유입 채널은 첫 페이지뷰로만 정하므로, 이후 페이지뷰에는 다시 붙이지 않는다.
  trackingState.landingPage = null;

  try {
    analytics.track(
      createPageViewEvent({ origin, pagePath, referrerPath, landingPage }),
    );
  } catch {
    // 계측 오류는 화면 이동에서 격리한다.
  }
}

export function startRouterPageViewTracking(
  router: SubscribableRouter,
  analytics: AnalyticsClient,
  origin: string,
  trackingState = createRouterPageViewTrackingState(),
  deferHomeEntry = false,
) {
  const trackRouterState = (state: RouterStateSnapshot) => {
    if (!state.initialized || state.navigation.state !== "idle") {
      return;
    }

    const pagePath = normalizePagePath(state.location.pathname);

    if (!pagePath || (deferHomeEntry && pagePath === "/")) return;
    trackPageView(pagePath, analytics, origin, trackingState);
  };

  const unsubscribe = router.subscribe(trackRouterState);
  trackRouterState(router.state);

  return unsubscribe;
}
