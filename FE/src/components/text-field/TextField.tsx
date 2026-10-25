import { useId } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { ChevronDown } from "../icons/Chevron";
import { FieldFrame, fieldDescription } from "./FieldFrame";
import "./TextField.css";

export type TextFieldProps = ComponentPropsWithRef<"input"> & {
  label: string;
  help?: ReactNode;
  hasError?: boolean;
  variant?: "box" | "line";
  labelHidden?: boolean;
  right?: ReactNode;
};

function TextFieldRoot({
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
    <FieldFrame
      id={id}
      label={label}
      help={help}
      hasError={hasError}
      required={props.required}
      labelHidden={labelHidden}
      variant={variant}
      disabled={props.disabled}
      readOnly={props.readOnly}
      className={className}
    >
      <div className="bibbidi-text-field-control">
        <input
          {...props}
          id={id}
          className="bibbidi-text-field-input"
          aria-invalid={hasError || invalid || undefined}
          aria-describedby={fieldDescription(id, help, describedBy)}
        />
        {right && <span className="bibbidi-text-field-right">{right}</span>}
      </div>
    </FieldFrame>
  );
}

export type TextFieldButtonProps = Omit<
  ComponentPropsWithRef<"button">,
  "children" | "value" | "type"
> & {
  label: string;
  value?: string;
  placeholder?: string;
  help?: ReactNode;
  hasError?: boolean;
  required?: boolean;
};

function FieldButton({
  label,
  value,
  placeholder = "선택해 주세요",
  help,
  hasError,
  required,
  id: providedId,
  className,
  disabled,
  "aria-describedby": describedBy,
  "aria-labelledby": labelledBy,
  ...props
}: TextFieldButtonProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <FieldFrame
      id={id}
      label={label}
      help={help}
      hasError={hasError}
      required={required}
      disabled={disabled}
      className={className}
    >
      {required && (
        <span id={`${id}-required`} className="bibbidi-text-field-sr-only">
          필수 항목입니다.
        </span>
      )}
      <button
        {...props}
        id={id}
        type="button"
        disabled={disabled}
        className="bibbidi-text-field-control bibbidi-text-field-button"
        aria-labelledby={labelledBy ?? `${id}-label ${id}-value`}
        aria-describedby={
          [
            required ? `${id}-required` : undefined,
            fieldDescription(id, help, describedBy),
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        <span
          id={`${id}-value`}
          className="bibbidi-text-field-value"
          data-placeholder={!value || undefined}
        >
          {value || placeholder}
        </span>
        <span className="bibbidi-text-field-right" aria-hidden="true">
          <ChevronDown />
        </span>
      </button>
    </FieldFrame>
  );
}

export const TextField = Object.assign(TextFieldRoot, { Button: FieldButton });
