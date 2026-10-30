import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { getButtonInteractionProps } from "../../shared/button/getButtonInteractionProps";
import "./IconButton.css";

export type IconButtonVariant = "clear" | "fill" | "border";
export type IconButtonProps = Omit<
  ComponentPropsWithRef<"button">,
  "children" | "color" | "aria-label"
> & {
  /** A decorative icon; put the action's accessible name on the button. */
  icon: ReactNode;
  "aria-label": string;
  variant?: IconButtonVariant;
  iconSize?: number;
  color?: string;
  bgColor?: string;
  /** Prevents repeated activation while keeping the button in the tab order. */
  loading?: boolean;
};

export function IconButton({
  icon,
  "aria-label": label,
  variant = "clear",
  iconSize = 24,
  color = "var(--color-fg-neutral)",
  bgColor = "var(--color-bg-neutral-weak)",
  loading = false,
  disabled = false,
  type = "button",
  className,
  style,
  onClick,
  "aria-disabled": ariaDisabled,
  "aria-busy": ariaBusy,
  ...props
}: IconButtonProps) {
  const resolvedSize =
    Number.isFinite(iconSize) && iconSize > 0 ? iconSize : 24;
  const variables = {
    "--icon-button-icon-size": `${resolvedSize}px`,
    "--icon-button-color": color,
    "--icon-button-background": bgColor,
    ...style,
  } as CSSProperties;

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
      aria-label={label}
      className={["bibbidi-icon-button", className].filter(Boolean).join(" ")}
      style={variables}
      data-variant={variant}
      data-loading={loading || undefined}
    >
      <span className="bibbidi-icon-button-icon" aria-hidden="true">
        {icon}
      </span>
      {loading && (
        <span className="bibbidi-icon-button-loader" aria-hidden="true" />
      )}
    </button>
  );
}
