import { useId, useRef, useState } from "react";
import type { Ref } from "react";
import { PickerFieldActions } from "./PickerFieldActions";
import { DatePicker, type DatePickerProps } from "../date-picker";
import { localToday } from "../date-picker/date-utils";
import { Popover } from "../popover";
import { TextField } from "../text-field";
import { TimePicker, type TimePickerMinuteStep } from "../time-picker";
import { BottomSheet } from "../bottom-sheet";
import { useIsMobileLayout } from "../../shared/responsive";
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
  const mobile = useIsMobileLayout();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const open = draft !== null && !disabled;
  if (disabled && draft !== null) setDraft(null);

  function changeOpen(next: boolean) {
    if (next) setDraft(value || (kind === "date" ? localToday() : "00:00"));
    else setDraft(null);
  }
  function confirm() {
    if (draft === null) return;
    onChange(draft);
    changeOpen(false);
    if (!mobile) triggerRef.current?.focus({ preventScroll: true });
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
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={mobile && open ? `${id}-sheet` : undefined}
      onClick={() => changeOpen(!open)}
      onBlur={onBlur}
    />
  );
  const picker = open && (
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
  const actions = (
    <PickerFieldActions
      mobile={mobile}
      clearable={kind === "time"}
      disabled={!open}
      onClear={() => setDraft("")}
      onConfirm={confirm}
    />
  );

  return (
    <>
      {mobile ? (
        trigger
      ) : (
        <Popover
          title={`${label} 선택`}
          placement="left-start"
          width={360}
          trigger={trigger}
          disabled={disabled}
          open={open}
          onOpenChange={changeOpen}
          footer={actions}
        >
          {picker}
        </Popover>
      )}
      {mobile && (
        <BottomSheet
          id={`${id}-sheet`}
          open={open}
          onClose={() => changeOpen(false)}
          onExited={() => triggerRef.current?.focus({ preventScroll: true })}
          header={<BottomSheet.Header>{label} 선택</BottomSheet.Header>}
          cta={actions}
        >
          {picker}
        </BottomSheet>
      )}
    </>
  );
}
