import type { AnalyticsClient } from "../../infrastructure/analytics";
import {
  createPageViewEvent,
  normalizePagePath,
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
}

export function createRouterPageViewTrackingState(): RouterPageViewTrackingState {
  return { lastTrackedPagePath: null };
}

export function trackPageView(
  pagePath: PagePath,
  analytics: AnalyticsClient,
  origin: string,
  trackingState: RouterPageViewTrackingState,
) {
  if (pagePath === trackingState.lastTrackedPagePath) return;

  const referrerPath = trackingState.lastTrackedPagePath;
  trackingState.lastTrackedPagePath = pagePath;

  try {
    analytics.track(createPageViewEvent({ origin, pagePath, referrerPath }));
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
