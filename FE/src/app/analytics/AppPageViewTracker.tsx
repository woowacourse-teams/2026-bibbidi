import { useEffect, useRef } from "react";

import { useAuth } from "../../features/auth";
import type { AnalyticsClient } from "../../infrastructure/analytics";
import {
  createRouterPageViewTrackingState,
  startRouterPageViewTracking,
  type SubscribableRouter,
} from "./routerPageViewTracking";

interface AppPageViewTrackerProps {
  analytics: AnalyticsClient;
  origin: string;
  router: SubscribableRouter;
}

export function AppPageViewTracker({
  analytics,
  origin,
  router,
}: AppPageViewTrackerProps) {
  const { authState } = useAuth();
  const trackingState = useRef(createRouterPageViewTrackingState());
  const isAppRouteSettled =
    authState.status === "authenticated" || authState.status === "guest";

  useEffect(() => {
    if (!isAppRouteSettled) {
      return;
    }

    return startRouterPageViewTracking(
      router,
      analytics,
      origin,
      trackingState.current,
    );
  }, [analytics, isAppRouteSettled, origin, router]);

  return null;
}
