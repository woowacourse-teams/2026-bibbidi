import type { ComponentPropsWithRef, ReactNode } from "react";
import { getButtonInteractionProps } from "../../shared/button/getButtonInteractionProps";
import "./ListFooter.css";

export type ListFooterBorder = "full" | "indented" | "none";
export type ListFooterHorizontalPadding = "none" | "small" | "medium";
export type ListFooterProps = ComponentPropsWithRef<"button"> & {
  icon?: ReactNode;
  border?: ListFooterBorder;
  horizontalPadding?: ListFooterHorizontalPadding;
  loading?: boolean;
};

/** A list's trailing action. Data loading and expansion belong to its owner. */
export function ListFooter({
  children,
  icon,
  border = "full",
  horizontalPadding = "medium",
  loading = false,
  disabled = false,
  type = "button",
  className,
  onClick,
  "aria-disabled": ariaDisabled,
  "aria-busy": ariaBusy,
  ...props
}: ListFooterProps) {
  return (
    <button
      {...props}
      {...getButtonInteractionProps({
        disabled,
        loading,
        onClick,
        "aria-disabled": ariaDisabled,
        "aria-busy": ariaBusy,
      })}
      type={type}
      className={["bibbidi-list-footer", className].filter(Boolean).join(" ")}
      data-border={border}
      data-horizontal-padding={horizontalPadding}
      data-loading={loading || undefined}
    >
      {loading ? (
        <span className="bibbidi-list-footer-spinner" aria-hidden="true" />
      ) : (
        icon != null && (
          <span className="bibbidi-list-footer-icon" aria-hidden="true">
            {icon}
          </span>
        )
      )}
      <span className="bibbidi-list-footer-label">{children}</span>
    </button>
  );
}
