import { useLayoutEffect } from "react";
import { useLocation } from "../navigation/navigation";
import { startPagePerformanceTracking } from "../../infrastructure/analytics";
import type { TimingRouter } from "../../infrastructure/analytics/pageContentTiming";

export function createNavigationTiming() {
  const listeners = new Set<(state: TimingRouter["state"]) => void>();
  const router: TimingRouter = {
    state: { location: { pathname: "" }, navigation: {} },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  function publish(pathname: string, committed: boolean) {
    if (!committed && pathname === router.state.location.pathname) return;
    router.state = committed
      ? { location: { pathname }, navigation: {} }
      : {
          location: router.state.location,
          navigation: { location: { pathname } },
        };
    listeners.forEach((listener) => listener(router.state));
  }
  return { router, publish };
}

export function NavigationTracking({
  timing,
}: {
  timing: ReturnType<typeof createNavigationTiming>;
}) {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    timing.publish(pathname, true);
  }, [pathname, timing]);
  useLayoutEffect(() => startPagePerformanceTracking(timing.router), [timing]);
  return null;
}
