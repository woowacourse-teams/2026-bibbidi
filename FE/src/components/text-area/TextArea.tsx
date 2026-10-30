import { useId } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import "./TextArea.css";

export type TextAreaProps = ComponentPropsWithRef<"textarea"> & {
  label: string;
  help?: ReactNode;
  hasError?: boolean;
};

export function TextArea({
  label,
  help,
  hasError,
  id: providedId,
  className,
  rows = 4,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: TextAreaProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div
      className={["bibbidi-text-area", className].filter(Boolean).join(" ")}
      data-variant="box"
      data-error={hasError || undefined}
    >
      <label className="bibbidi-text-area-label" htmlFor={id}>
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>
      <textarea
        {...props}
        id={id}
        rows={rows}
        className="bibbidi-text-area-input"
        style={{ "--text-area-rows": rows, ...props.style } as CSSProperties}
        aria-invalid={hasError || invalid || undefined}
        aria-describedby={
          [describedBy, help ? `${id}-help` : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      {help && (
        <div
          className="bibbidi-text-area-help"
          id={`${id}-help`}
          aria-live="polite"
        >
          {help}
        </div>
      )}
    </div>
  );
}
