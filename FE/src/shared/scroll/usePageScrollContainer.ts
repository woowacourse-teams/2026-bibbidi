import { useCallback, useState } from "react";

/** Resolve the service-owned scroll area before mounting a portaled layer. */
export function usePageScrollContainer() {
  const [environment, setEnvironment] = useState<{
    scrollContainer: HTMLElement | null;
  } | null>(null);
  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const scope =
      element.closest("[data-modal-scope]") ?? element.ownerDocument;
    setEnvironment({
      scrollContainer:
        scope instanceof HTMLElement &&
        scope.matches("[data-page-scroll-container]")
          ? scope
          : scope.querySelector<HTMLElement>("[data-page-scroll-container]"),
    });
  }, []);
  return { ref, environment };
}
