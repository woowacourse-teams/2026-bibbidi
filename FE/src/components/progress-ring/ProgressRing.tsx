import type { ComponentProps } from "react";
import "./ProgressRing.css";

type ProgressRingProps = ComponentProps<"svg"> & { value: number };

/** Decorative percentage ring; its parent supplies the visible progress label. */
export function ProgressRing({
  value,
  className,
  ...props
}: ProgressRingProps) {
  const percentage = Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={["bibbidi-progress-ring", className].filter(Boolean).join(" ")}
      {...props}
    >
      <circle cx="12" cy="12" pathLength="100" r="9" />
      <circle
        className="bibbidi-progress-ring-range"
        cx="12"
        cy="12"
        pathLength="100"
        r="9"
        strokeDasharray={`${percentage} ${100 - percentage}`}
      />
    </svg>
  );
}
