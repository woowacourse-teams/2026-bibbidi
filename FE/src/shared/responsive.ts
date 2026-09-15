import { useEffect, useState } from "react";

export const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 760px)";

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
  const [matches, setMatches] = useState(() =>
    getMediaQueryMatch(query, fallback),
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

export function useIsMobileLayout() {
  return useMediaQuery(MOBILE_LAYOUT_MEDIA_QUERY);
}
