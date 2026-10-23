import { useLayoutEffect, useRef, useState } from "react";
import { useIsMobileLayout } from "../../shared/responsive";
import { getWorkspaceLayout } from "./layout";
import type { WorkspaceLayoutMetrics, WorkspaceLayoutState } from "./layout";

const metricTokens: Record<keyof WorkspaceLayoutMetrics, string> = {
  md: "--layout-breakpoint-md",
  lg: "--layout-breakpoint-lg",
  xl: "--layout-breakpoint-xl",
  category: "--layout-width-category",
  detail: "--layout-width-detail",
  mainMin: "--layout-width-main-min",
  gutter: "--layout-gutter-desktop",
};

/** Keep screen state outside the layout so changing presentation preserves drafts. */
export function useWorkspaceLayout(hasNavigation: boolean, hasAside: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobileLayout();
  const [placement, setPlacement] = useState<
    Pick<WorkspaceLayoutState, "navigationPlacement" | "asidePlacement">
  >({
    navigationPlacement: "top",
    asidePlacement: "docked",
  });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const styles = getComputedStyle(element);
      const metrics = Object.fromEntries(
        Object.entries(metricTokens).map(([key, token]) => [
          key,
          Number.parseFloat(styles.getPropertyValue(token)),
        ]),
      ) as WorkspaceLayoutMetrics;
      // Layout requires the shared px tokens. Unstyled hosts keep the baseline.
      if (Object.values(metrics).some((value) => !Number.isFinite(value)))
        return;
      const width =
        element.getBoundingClientRect().width -
        (Number.parseFloat(styles.paddingLeft) || 0) -
        (Number.parseFloat(styles.paddingRight) || 0) -
        (Number.parseFloat(styles.borderLeftWidth) || 0) -
        (Number.parseFloat(styles.borderRightWidth) || 0);
      const next = getWorkspaceLayout(
        window.innerWidth,
        width,
        hasNavigation,
        hasAside,
        metrics,
      );
      setPlacement((previous) =>
        previous.navigationPlacement === next.navigationPlacement &&
        previous.asidePlacement === next.asidePlacement
          ? previous
          : next,
      );
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [hasNavigation, hasAside, isMobile]);
  return {
    ref,
    layout: {
      ...placement,
      isMobile,
      asidePlacement: isMobile ? "overlay" : placement.asidePlacement,
    } as WorkspaceLayoutState,
  };
}
