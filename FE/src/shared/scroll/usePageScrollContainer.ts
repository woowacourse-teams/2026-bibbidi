import { useCallback, useState } from "react";

/** Resolve the scroll area owned by the layer anchor's nearest modal scope. */
export function usePageScrollContainer() {
  const [environment, setEnvironment] = useState<{
    scrollContainer: HTMLElement | null;
  } | null>(null);
  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const scope = element.closest<HTMLElement>("[data-modal-scope]");
    setEnvironment({
      scrollContainer: scope?.matches("[data-page-scroll-container]")
        ? scope
        : (Array.from(
            scope?.querySelectorAll<HTMLElement>(
              "[data-page-scroll-container]",
            ) ?? [],
          ).find(
            (container) => container.closest("[data-modal-scope]") === scope,
          ) ?? null),
    });
  }, []);
  return { ref, environment };
}
