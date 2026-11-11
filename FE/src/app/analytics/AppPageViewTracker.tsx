import { useEffect, useLayoutEffect, useRef } from "react";
import { useAuth } from "../../features/auth";
import {
  analytics,
  type AnalyticsClient,
} from "../../infrastructure/analytics";
import { setErrorContext } from "../../infrastructure/error-tracking";
import { useLocation } from "../navigation/navigation";
import { normalizePagePath } from "./pageView";
import {
  createRouterPageViewTrackingState,
  trackPageView,
} from "./routerPageViewTracking";

export function AppPageViewTracker({
  client = analytics,
  origin,
}: { client?: AnalyticsClient; origin?: string } = {}) {
  const { authState } = useAuth();
  const { pathname, ready, search } = useLocation();
  const tracking = useRef<ReturnType<
    typeof createRouterPageViewTrackingState
  > | null>(null);
  const previousMember = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (!ready) return;
    client.initialize();
    if (!tracking.current) {
      tracking.current = createRouterPageViewTrackingState({
        pathname,
        search,
        referrer: document.referrer,
      });
    }
    const context = {
      authState: authState.status,
      pathname,
      userId:
        authState.status === "authenticated" ? authState.user.id : undefined,
    };
    client.setContext(context);
    setErrorContext(context);
  }, [authState, client, pathname, ready, search]);
  useEffect(() => {
    if (
      !ready ||
      (authState.status !== "guest" &&
        authState.status !== "authenticated" &&
        authState.status !== "onboardingRequired")
    )
      return;
    const memberId =
      authState.status === "authenticated" ? authState.user.id : undefined;
    const state = tracking.current;
    if (!state) return;
    if (
      previousMember.current !== undefined &&
      previousMember.current !== memberId
    ) {
      state.lastTrackedPagePath = null;
    }
    previousMember.current = memberId;
    const page = normalizePagePath(pathname);
    if (page)
      trackPageView(page, client, origin ?? window.location.origin, state);
  }, [authState, client, origin, pathname, ready]);
  return null;
}
