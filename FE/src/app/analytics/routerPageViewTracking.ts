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

export function startRouterPageViewTracking(
  router: SubscribableRouter,
  analytics: AnalyticsClient,
  origin: string,
  trackingState = createRouterPageViewTrackingState(),
) {
  const trackRouterState = (state: RouterStateSnapshot) => {
    if (!state.initialized || state.navigation.state !== "idle") {
      return;
    }

    const pagePath = normalizePagePath(state.location.pathname);

    if (!pagePath || pagePath === trackingState.lastTrackedPagePath) {
      return;
    }

    const referrerPath = trackingState.lastTrackedPagePath;
    trackingState.lastTrackedPagePath = pagePath;

    try {
      analytics.track(createPageViewEvent({ origin, pagePath, referrerPath }));
    } catch {
      // 라우터 구독과 이벤트 생성 오류도 제품 탐색 흐름에서 격리한다.
    }
  };

  const unsubscribe = router.subscribe(trackRouterState);
  trackRouterState(router.state);

  return unsubscribe;
}
