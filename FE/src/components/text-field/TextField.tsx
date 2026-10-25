import { useId } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import "./TextField.css";

export type TextFieldProps = ComponentPropsWithRef<"input"> & {
  label: string;
  help?: ReactNode;
  hasError?: boolean;
  variant?: "box" | "line";
  labelHidden?: boolean;
  right?: ReactNode;
};

export function TextField({
  label,
  help,
  hasError,
  variant = "box",
  labelHidden,
  right,
  id: providedId,
  className,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div
      className={["bibbidi-text-field", className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-error={hasError || undefined}
      data-disabled={props.disabled || undefined}
      data-readonly={props.readOnly || undefined}
    >
      <label
        className="bibbidi-text-field-label"
        data-hidden={labelHidden || undefined}
        htmlFor={id}
      >
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>
      <div className="bibbidi-text-field-control">
        <input
          {...props}
          id={id}
          className="bibbidi-text-field-input"
          aria-invalid={hasError || invalid || undefined}
          aria-describedby={
            [describedBy, help ? `${id}-help` : undefined]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        {right && <span className="bibbidi-text-field-right">{right}</span>}
      </div>
      {help && (
        <div
          className="bibbidi-text-field-help"
          id={`${id}-help`}
          aria-live="polite"
        >
          {help}
        </div>
      )}
    </div>
  );
}
