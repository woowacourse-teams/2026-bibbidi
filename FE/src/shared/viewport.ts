import { useLayoutEffect, useState, type CSSProperties } from "react";

export interface ViewportMetrics {
  height: number;
  offsetTop: number;
  layoutHeight: number;
  layoutWidth: number;
  scale: number;
  bottomInset: number;
}

function readViewport(): ViewportMetrics {
  const view = typeof window === "undefined" ? undefined : window;
  const viewport = view?.visualViewport;
  const height = viewport?.height ?? view?.innerHeight ?? 0;
  const offsetTop = viewport?.offsetTop ?? 0;
  const layoutHeight = view?.innerHeight ?? 0;
  return {
    height,
    offsetTop,
    layoutHeight,
    layoutWidth: view?.innerWidth ?? 0,
    scale: viewport?.scale ?? 1,
    bottomInset: Math.max(0, layoutHeight - height - offsetTop),
  };
}

/** Consumers share measurements rather than each owning viewport event handlers. */
export function useViewportMetrics(active: boolean) {
  const [metrics, setMetrics] = useState(readViewport);
  useLayoutEffect(() => {
    if (!active) return;
    const viewport = window.visualViewport;
    const update = () => {
      const next = readViewport();
      setMetrics((current) =>
        current.height === next.height &&
        current.offsetTop === next.offsetTop &&
        current.layoutHeight === next.layoutHeight &&
        current.layoutWidth === next.layoutWidth &&
        current.scale === next.scale
          ? current
          : next,
      );
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [active]);
  return metrics;
}

export function viewportStyles(
  metrics: ViewportMetrics,
  prefix: string,
): CSSProperties {
  return {
    [`--${prefix}-viewport-height`]: `${metrics.height}px`,
    [`--${prefix}-viewport-top`]: `${metrics.offsetTop}px`,
    [`--${prefix}-bottom-inset`]: `${metrics.bottomInset}px`,
  } as CSSProperties;
}
