import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  ReactNode,
} from "react";
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
  const unavailable =
    disabled || loading || ariaDisabled === true || ariaDisabled === "true";
  const resolvedSize =
    Number.isFinite(iconSize) && iconSize > 0 ? iconSize : 24;
  const variables = {
    "--icon-button-icon-size": `${resolvedSize}px`,
    "--icon-button-color": color,
    "--icon-button-background": bgColor,
    ...style,
  } as CSSProperties;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (unavailable) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      className={["bibbidi-icon-button", className].filter(Boolean).join(" ")}
      style={variables}
      data-variant={variant}
      data-loading={loading || undefined}
      disabled={disabled}
      aria-disabled={unavailable || ariaDisabled}
      aria-busy={loading || ariaBusy}
      onClick={handleClick}
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
