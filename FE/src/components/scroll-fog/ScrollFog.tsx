import type { ComponentPropsWithRef, CSSProperties } from "react";
import "./ScrollFog.css";

export type ScrollFogPlacement = "top" | "bottom" | "left" | "right";

export type ScrollFogProps = ComponentPropsWithRef<"div"> & {
  placement?: ScrollFogPlacement[];
  /** Fade depth in pixels. Per-edge sizes take priority. */
  size?: number;
  sizes?: Partial<Record<ScrollFogPlacement, number>>;
  hideScrollBar?: boolean;
};

const edges: ScrollFogPlacement[] = ["top", "bottom", "left", "right"];

/** className/style target the frame; ref and other HTML props target the scroll viewport. */
export function ScrollFog({
  placement = ["top", "bottom"],
  size = 20,
  sizes,
  hideScrollBar = false,
  className,
  style,
  children,
  tabIndex = 0,
  ...props
}: ScrollFogProps) {
  const variables = Object.fromEntries(
    edges.map((edge) => {
      const depth = sizes?.[edge] ?? size;
      return [
        `--scroll-fog-${edge}`,
        `${placement.includes(edge) ? Math.max(0, Number.isFinite(depth) ? depth : 20) : 0}px`,
      ];
    }),
  );

  return (
    <div
      className={["bibbidi-scroll-fog", className].filter(Boolean).join(" ")}
      style={{ ...style, ...variables } as CSSProperties}
    >
      <div
        {...props}
        tabIndex={tabIndex}
        className="bibbidi-scroll-fog-viewport"
        data-hide-scrollbar={hideScrollBar || undefined}
      >
        {children}
      </div>
    </div>
  );
}
