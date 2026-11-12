import { useCallback, useSyncExternalStore } from "react";

// Keep this condition aligned with --layout-breakpoint-md in ../styles/tokens.css.
export const MOBILE_LAYOUT_MEDIA_QUERY = "(width < 768px)";

function getMediaQueryMatch(query: string, fallback: boolean) {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return fallback;
  }

  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string, fallback = false) {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    },
    [query],
  );
  const getSnapshot = () => getMediaQueryMatch(query, fallback);
  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}

export function useIsMobileLayout() {
  return useMediaQuery(MOBILE_LAYOUT_MEDIA_QUERY);
}
