import type { ComponentPropsWithRef, CSSProperties } from "react";
import "./ProgressBar.css";

export type ProgressBarSize = "light" | "normal" | "bold";

export type ProgressBarProps = Omit<
  ComponentPropsWithRef<"div">,
  | "children"
  | "color"
  | "role"
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuenow"
> & {
  /** Completion ratio from 0 to 1. */
  progress: number;
  size?: ProgressBarSize;
  /** CSS color value. Defaults to the brand background token. */
  color?: string;
  animate?: boolean;
};

export function ProgressBar({
  progress,
  size = "normal",
  color = "var(--color-bg-brand-solid)",
  animate = false,
  className,
  style,
  ...props
}: ProgressBarProps) {
  const value = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;

  return (
    <div
      {...props}
      className={["bibbidi-progress-bar", className].filter(Boolean).join(" ")}
      style={{ ...style, "--progress-bar-color": color } as CSSProperties}
      data-size={size}
      data-animate={animate || undefined}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Number((value * 100).toFixed(4))}
    >
      <div
        className="bibbidi-progress-bar-fill"
        style={{ transform: `scaleX(${value})` }}
      />
    </div>
  );
}
