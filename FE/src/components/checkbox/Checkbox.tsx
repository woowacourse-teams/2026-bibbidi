import type { ComponentPropsWithRef, CSSProperties } from "react";
import "./Checkbox.css";

export type CheckboxProps = Omit<
  ComponentPropsWithRef<"input">,
  "type" | "role" | "size" | "children" | "aria-checked" | "readOnly"
> & {
  inputType?: "checkbox" | "radio";
  size?: number;
  onCheckedChange?: (checked: boolean) => void;
};

function CheckboxControl({
  variant,
  inputType = "checkbox",
  size = 24,
  disabled = false,
  className,
  style,
  onChange,
  onCheckedChange,
  "aria-disabled": ariaDisabled,
  ...props
}: CheckboxProps & { variant: "circle" | "line" }) {
  const unavailable =
    disabled || ariaDisabled === true || ariaDisabled === "true";
  const dimension = Number.isFinite(size) && size > 0 ? size : 24;

  return (
    <span
      className={["bibbidi-checkbox", className].filter(Boolean).join(" ")}
      data-variant={variant}
      style={{ ...style, "--checkbox-size": `${dimension}px` } as CSSProperties}
    >
      <input
        {...props}
        className="bibbidi-checkbox-input"
        type={inputType}
        disabled={unavailable}
        aria-disabled={unavailable || undefined}
        onChange={(event) => {
          const nextChecked = event.currentTarget.checked;
          onChange?.(event);
          onCheckedChange?.(nextChecked);
        }}
      />
      <span className="bibbidi-checkbox-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="m6.5 12 3.5 3.5 7.5-7.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}

function Circle(props: CheckboxProps) {
  return <CheckboxControl {...props} variant="circle" />;
}

function Line(props: CheckboxProps) {
  return <CheckboxControl {...props} variant="line" />;
}

/** Native input semantics, form behavior and ref. The default shape is Circle. */
export const Checkbox = Object.assign(Circle, { Circle, Line });
