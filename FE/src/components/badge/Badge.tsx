import type { ComponentPropsWithRef, ReactNode } from "react";
import "./Badge.css";

export type BadgeSize = "xsmall" | "small" | "medium" | "large";
export type BadgeColor =
  "primary" | "dark" | "positive" | "warning" | "danger" | "informative";
export type BadgeVariant = "fill" | "weak";

export type BadgeProps = Omit<
  ComponentPropsWithRef<"span">,
  "color" | "children"
> & {
  size?: BadgeSize;
  color?: BadgeColor;
  variant?: BadgeVariant;
  children: ReactNode;
};

/** A non-interactive label describing an item's status or category. */
export function Badge({
  size = "small",
  color = "primary",
  variant = "weak",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={["bibbidi-badge", className].filter(Boolean).join(" ")}
      data-size={size}
      data-color={color}
      data-variant={variant}
    >
      <span className="bibbidi-badge-label">{children}</span>
    </span>
  );
}
