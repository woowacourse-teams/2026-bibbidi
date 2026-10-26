import type { ComponentPropsWithRef, MouseEvent, ReactNode } from "react";
import "./Button.css";

export type ButtonSize = "small" | "medium" | "large" | "xlarge";
export type ButtonColor = "primary" | "dark" | "danger" | "light";
export type ButtonVariant = "fill" | "weak";
export type ButtonDisplay = "inline" | "block" | "full";

export type ButtonProps = Omit<ComponentPropsWithRef<"button">, "color"> & {
  size?: ButtonSize;
  color?: ButtonColor;
  variant?: ButtonVariant;
  /** block fills the container; full also removes the corner radius. */
  display?: ButtonDisplay;
  /** Keeps the label and width while preventing repeated activation. */
  loading?: boolean;
};

function Root({
  size = "xlarge",
  color = "primary",
  variant = "fill",
  display = "inline",
  loading = false,
  disabled = false,
  type = "button",
  className,
  children,
  onClick,
  "aria-disabled": ariaDisabled,
  "aria-busy": ariaBusy,
  ...props
}: ButtonProps) {
  const unavailable =
    disabled || loading || ariaDisabled === true || ariaDisabled === "true";

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
      className={["bibbidi-button", className].filter(Boolean).join(" ")}
      data-size={size}
      data-color={color}
      data-variant={variant}
      data-display={display}
      data-loading={loading || undefined}
      disabled={disabled}
      aria-disabled={unavailable || ariaDisabled}
      aria-busy={loading || ariaBusy}
      onClick={handleClick}
    >
      <ButtonContent loading={loading}>{children}</ButtonContent>
    </button>
  );
}

function ButtonContent({
  children,
  loading = false,
}: {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <>
      <span className="bibbidi-button-label">{children}</span>
      {loading && (
        <span className="bibbidi-button-loader" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )}
    </>
  );
}
export type ButtonLinkProps = Omit<ComponentPropsWithRef<"a">, "color"> &
  Pick<ButtonProps, "size" | "color" | "variant" | "display">;
function Link({
  size = "xlarge",
  color = "primary",
  variant = "fill",
  display = "inline",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <a
      {...props}
      className={["bibbidi-button", className].filter(Boolean).join(" ")}
      data-size={size}
      data-color={color}
      data-variant={variant}
      data-display={display}
    >
      <ButtonContent>{children}</ButtonContent>
    </a>
  );
}
export const Button = Object.assign(Root, { Link });
