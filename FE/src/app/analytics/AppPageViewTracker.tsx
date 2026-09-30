import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

import { useAuth } from "../../features/auth";
import type { AnalyticsClient } from "../../infrastructure/analytics";
import {
  createRouterPageViewTrackingState,
  startRouterPageViewTracking,
  trackPageView,
  type SubscribableRouter,
} from "./routerPageViewTracking";

export const HomeEntryPageViewContext = createContext<(() => void) | null>(
  null,
);

interface AppPageViewTrackerProps {
  analytics: AnalyticsClient;
  children?: ReactNode;
  origin: string;
  router: SubscribableRouter;
}

export function AppPageViewTracker({
  analytics,
  children,
  origin,
  router,
}: AppPageViewTrackerProps) {
  const { authState } = useAuth();
  const trackingState = useRef(createRouterPageViewTrackingState());
  const previousMemberId = useRef<number | undefined>(undefined);
  const isAppRouteSettled =
    authState.status === "authenticated" ||
    authState.status === "guest" ||
    authState.status === "onboardingRequired" ||
    authState.status === "accountSetupRequired";

  const trackHomeEntryPageView = useCallback(() => {
    if (router.state.location.pathname !== "/" || !isAppRouteSettled) return;
    trackPageView("/", analytics, origin, trackingState.current);
  }, [analytics, isAppRouteSettled, origin, router]);

  useLayoutEffect(() => {
    if (isAppRouteSettled) {
      const memberId =
        authState.status === "authenticated" ? authState.user.id : undefined;
      if (
        previousMemberId.current !== undefined &&
        previousMemberId.current !== memberId
      ) {
        trackingState.current.lastTrackedPagePath = null;
      }
      previousMemberId.current = memberId;
    }
    const synchronizeContext = () =>
      analytics.setContext({
        authState: authState.status,
        pathname: router.state.location.pathname,
        userId:
          authState.status === "authenticated" ? authState.user.id : undefined,
      });
    synchronizeContext();
    const unsubscribeContext = router.subscribe(synchronizeContext);
    return () => {
      unsubscribeContext();
      analytics.setContext({
        authState: "loading",
        pathname: router.state.location.pathname,
      });
    };
  }, [analytics, authState, isAppRouteSettled, router]);

  useEffect(() => {
    if (!isAppRouteSettled) {
      return;
    }

    return startRouterPageViewTracking(
      router,
      analytics,
      origin,
      trackingState.current,
      true,
    );
  }, [analytics, authState, isAppRouteSettled, origin, router]);

  return (
    <HomeEntryPageViewContext.Provider value={trackHomeEntryPageView}>
      {children}
    </HomeEntryPageViewContext.Provider>
  );
}
