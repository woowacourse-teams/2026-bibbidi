import { vi } from "vitest";

interface MatchMediaController {
  setMatches: (matches: boolean) => void;
}

export function installMatchMedia(
  query: string,
  initialMatches: boolean,
): MatchMediaController {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    addEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      listeners.add(listener);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    dispatchEvent: () => true,
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    removeEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      listeners.delete(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  } as unknown as MediaQueryList;

  vi.stubGlobal(
    "matchMedia",
    vi.fn((requestedQuery: string) => {
      if (requestedQuery !== query) {
        throw new Error(`예상하지 못한 media query: ${requestedQuery}`);
      }

      return mediaQueryList;
    }),
  );

  return {
    setMatches(nextMatches) {
      matches = nextMatches;
      const event = { matches, media: query } as MediaQueryListEvent;

      listeners.forEach((listener) => listener(event));
    },
  };
}
