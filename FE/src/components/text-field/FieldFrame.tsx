import type { ReactNode } from "react";

export interface FieldFrameProps {
  id: string;
  label: string;
  help?: ReactNode;
  hasError?: boolean;
  required?: boolean;
  labelHidden?: boolean;
  variant?: "box" | "line";
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  children: ReactNode;
}

export function fieldDescription(
  id: string,
  help: ReactNode,
  describedBy?: string,
) {
  return (
    [describedBy, help ? `${id}-help` : undefined].filter(Boolean).join(" ") ||
    undefined
  );
}

export function FieldFrame({
  id,
  label,
  help,
  hasError,
  required,
  labelHidden,
  variant = "box",
  disabled,
  readOnly,
  className,
  children,
}: FieldFrameProps) {
  return (
    <div
      className={["bibbidi-text-field", className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-error={hasError || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
    >
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="bibbidi-text-field-label"
        data-hidden={labelHidden || undefined}
      >
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
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
