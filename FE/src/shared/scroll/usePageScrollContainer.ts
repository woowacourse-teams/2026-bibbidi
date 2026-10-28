import { useCallback, useState } from "react";

/** Resolve the scroll area owned by the layer anchor's nearest modal scope. */
export function usePageScrollContainer() {
  const [environment, setEnvironment] = useState<{
    scrollContainer: HTMLElement | null;
  } | null>(null);
  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const scope = element.closest<HTMLElement>("[data-modal-scope]");
    const container = scope?.matches("[data-page-scroll-container]")
      ? scope
      : (Array.from(
          scope?.querySelectorAll<HTMLElement>(
            "[data-page-scroll-container]",
          ) ?? [],
        ).find(
          (container) => container.closest("[data-modal-scope]") === scope,
        ) ?? null);
    const update = () =>
      setEnvironment({
        scrollContainer:
          container?.dataset.scroll === "document"
            ? element.ownerDocument.documentElement
            : container,
      });
    update();
    // A mounted sheet must follow the actual scroll root across breakpoints.
    const observer = new MutationObserver(update);
    if (container)
      observer.observe(container, {
        attributes: true,
        attributeFilter: ["data-scroll"],
      });
    return () => observer.disconnect();
  }, []);
  return { ref, environment };
}
