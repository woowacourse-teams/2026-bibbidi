import type { ComponentPropsWithRef } from "react";
import "./Loader.css";

export type LoaderSize = "small" | "medium" | "large";
export type LoaderType = "primary" | "dark" | "light";

export type LoaderProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "role" | "aria-live" | "aria-atomic"
> & {
  size?: LoaderSize;
  type?: LoaderType;
  /** Text below the spinner. Newlines are preserved. */
  label?: string;
};

export function Loader({
  size = "medium",
  type = "primary",
  label,
  className,
  ...props
}: LoaderProps) {
  const hasLabel = Boolean(label?.trim());

  return (
    <div
      {...props}
      className={["bibbidi-loader", className].filter(Boolean).join(" ")}
      data-size={size}
      data-type={type}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="bibbidi-loader-spinner" aria-hidden="true" />
      {hasLabel ? (
        <span className="bibbidi-loader-label">{label}</span>
      ) : (
        <span className="bibbidi-loader-sr-only">불러오는 중이에요</span>
      )}
    </div>
  );
}
