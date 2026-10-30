import { useMemo, useSyncExternalStore } from "react";
import { usePageScrollContainer } from "../shared/scroll/usePageScrollContainer";

const COMPACT_SCROLL_OFFSET = 48;
const SCROLL_DIRECTION_THRESHOLD = 12;

function createCompactHeaderStore(container: HTMLElement | null | undefined) {
  const ownerDocument = container?.ownerDocument ?? document;
  const target =
    !container || container === ownerDocument.documentElement
      ? ownerDocument
      : container;
  const scrollRoot =
    container ??
    ownerDocument.scrollingElement ??
    ownerDocument.documentElement;
  const readScrollTop = () => Math.max(0, scrollRoot.scrollTop);
  let previousScrollTop = readScrollTop();
  let compact = previousScrollTop > COMPACT_SCROLL_OFFSET;

  return {
    getSnapshot: () => compact,
    subscribe: (onChange: () => void) => {
      const onScroll = () => {
        const scrollTop = readScrollTop();
        const delta = scrollTop - previousScrollTop;
        if (
          scrollTop > COMPACT_SCROLL_OFFSET &&
          Math.abs(delta) < SCROLL_DIRECTION_THRESHOLD
        ) {
          return;
        }
        previousScrollTop = scrollTop;
        const nextCompact = scrollTop > COMPACT_SCROLL_OFFSET && delta > 0;
        if (compact !== nextCompact) {
          compact = nextCompact;
          onChange();
        }
      };
      target.addEventListener("scroll", onScroll, { passive: true });
      return () => target.removeEventListener("scroll", onScroll);
    },
  };
}

export function useCompactHeaderLogin() {
  const { ref, environment } = usePageScrollContainer();
  const container = environment?.scrollContainer;
  const store = useMemo(() => createCompactHeaderStore(container), [container]);
  const compact = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => false,
  );
  return { ref, compact };
}
