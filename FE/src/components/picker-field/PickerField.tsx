import { useCallback, useId, useRef, useState } from "react";
import type { Ref } from "react";
import { PickerFieldActions } from "./PickerFieldActions";
import { DatePicker, type DatePickerProps } from "../date-picker";
import { localToday } from "../../shared/date/calendarDate";
import { PickerLayer } from "../picker-layer";
import { TextField } from "../text-field";
import { TimePicker, type TimePickerMinuteStep } from "../time-picker";
import "./PickerField.css";

interface FieldProps {
  label: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  ref?: Ref<HTMLButtonElement>;
}

export type PickerFieldProps = FieldProps &
  (
    | { kind: "date"; yearRange?: DatePickerProps["yearRange"] }
    | { kind: "time"; minuteStep?: TimePickerMinuteStep }
  );

/** Keeps temporary choices separate from the form until confirmation. */
export function PickerField(props: PickerFieldProps) {
  const {
    kind,
    label,
    id: providedId,
    value,
    onChange,
    onBlur,
    disabled = false,
    required = false,
    error,
    ref,
  } = props;
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [selection, setSelection] = useState<{
    open: boolean;
    draft: string | null;
  }>({ open: false, draft: null });
  const { draft } = selection;
  const setDraft = (next: string) =>
    setSelection((current) => ({ ...current, draft: next }));
  const open = selection.open && !disabled;
  if (disabled && selection.open) setSelection({ ...selection, open: false });
  function changeOpen(next: boolean) {
    setSelection((current) =>
      next
        ? {
            open: true,
            draft: value || (kind === "date" ? localToday() : "00:00"),
          }
        : { ...current, open: false },
    );
  }
  function confirm() {
    if (draft === null) return;
    onChange(draft);
    changeOpen(false);
  }
  const trigger = (
    <TextField.Button
      ref={(node) => {
        triggerRef.current = node;
        if (typeof ref === "function") return ref(node);
        if (ref) ref.current = node;
      }}
      id={id}
      label={label}
      value={value}
      placeholder={kind === "date" ? "날짜 선택" : "시간 선택"}
      disabled={disabled}
      required={required}
      hasError={!!error}
      help={error && <span role="alert">{error}</span>}
      onBlur={onBlur}
    />
  );
  const picker = draft !== null && (
    <>
      {kind === "date" ? (
        <DatePicker
          aria-label={`${label} 임시 선택`}
          value={draft!}
          yearRange={props.kind === "date" ? props.yearRange : undefined}
          onChange={setDraft}
        />
      ) : (
        <TimePicker
          aria-label={`${label} 임시 선택`}
          value={draft || "00:00"}
          minuteStep={props.kind === "time" ? props.minuteStep : undefined}
          onChange={setDraft}
        />
      )}
      <p className="bibbidi-picker-field-selection" role="status">
        선택한 {kind === "date" ? "날짜" : "시간"}: {draft || "미지정"}
      </p>
    </>
  );
  const actions = (mobile: boolean) => (
    <PickerFieldActions
      mobile={mobile}
      clearable={kind === "time"}
      disabled={!open}
      onClear={() => setDraft("")}
      onConfirm={confirm}
    />
  );

  const clearDraft = useCallback(() => {
    setSelection((current) =>
      current.open || current.draft === null
        ? current
        : { open: false, draft: null },
    );
  }, []);
  return (
    <PickerLayer
      trigger={trigger}
      title={`${label} 선택`}
      placement="left-start"
      disabled={disabled}
      open={open}
      onOpenChange={changeOpen}
      returnFocusRef={triggerRef}
      footer={actions}
      onExited={clearDraft}
    >
      {picker}
    </PickerLayer>
  );
}
