import { useLayoutEffect } from "react";
import type { RefObject } from "react";

/** Keep viewport-fixed service controls outside the actual docked panel bounds. */
export function useReservedPanelSpace(
  layoutRef: RefObject<HTMLDivElement | null>,
) {
  useLayoutEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    let panel: HTMLElement | null = null;
    const update = () => {
      const next = layout.querySelector<HTMLElement>("[data-docked-panel]");
      if (next !== panel) {
        if (panel) observer?.unobserve(panel);
        panel = next;
        if (panel) observer?.observe(panel);
      }
      const space = panel
        ? Math.max(0, window.innerWidth - panel.getBoundingClientRect().left)
        : 0;
      layout.style.setProperty("--service-side-panel-width", `${space}px`);
    };
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    const mutations = new MutationObserver(update);
    mutations.observe(layout, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-docked-panel"],
    });
    observer?.observe(layout);
    window.addEventListener("resize", update);
    update();
    return () => {
      mutations.disconnect();
      observer?.disconnect();
      window.removeEventListener("resize", update);
      layout.style.removeProperty("--service-side-panel-width");
    };
  }, [layoutRef]);
}
