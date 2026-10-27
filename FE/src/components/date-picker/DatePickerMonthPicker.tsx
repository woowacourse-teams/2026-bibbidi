import type { ComponentPropsWithRef } from "react";
import { dateObject, localToday, startOfMonth } from "./date-utils";
import { DatePickerMonthList } from "./DatePickerMonthList";
import "./DatePicker.css";

export type DatePickerMonthPickerProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "onChange" | "defaultValue"
> & {
  value: string;
  onChange: (month: string) => void;
  today?: string;
  minDate?: string;
  maxDate?: string;
  yearRange?: { start: number; end: number };
  disabled?: boolean;
};

/** Shared year/month selection. Values and changes use calendar dates (YYYY-MM-01). */
export function DatePickerMonthPicker({
  value,
  onChange,
  today = localToday(),
  minDate,
  maxDate,
  yearRange = {
    start: Number(today.slice(0, 4)) - 100,
    end: Number(today.slice(0, 4)) + 100,
  },
  disabled = false,
  className,
  "aria-label": label = "연·월 선택",
  "aria-disabled": ariaDisabled,
  ...props
}: DatePickerMonthPickerProps) {
  const unavailable =
    disabled || ariaDisabled === true || ariaDisabled === "true";
  const earliest = `${String(Math.max(1, yearRange.start)).padStart(4, "0")}-01-01`;
  const latest = `${String(Math.min(9999, yearRange.end)).padStart(4, "0")}-12-31`;
  const lower = minDate && minDate > earliest ? minDate : earliest;
  const upper = maxDate && maxDate < latest ? maxDate : latest;
  const clamp = (date: string) =>
    dateObject(date) < dateObject(lower)
      ? lower
      : dateObject(date) > dateObject(upper)
        ? upper
        : date;
  const current = startOfMonth(clamp(value));
  const years = Array.from(
    { length: Number(upper.slice(0, 4)) - Number(lower.slice(0, 4)) + 1 },
    (_, index) => {
      const year = Number(lower.slice(0, 4)) + index;
      return { value: year, label: `${year}년` };
    },
  );
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const key = `${current.slice(0, 4)}-${String(month).padStart(2, "0")}`;
    return {
      value: month,
      label: `${month}월`,
      disabled: key < lower.slice(0, 7) || key > upper.slice(0, 7),
    };
  });
  const chooseYear = (year: number) => {
    if (!unavailable)
      onChange(
        startOfMonth(
          clamp(`${String(year).padStart(4, "0")}-${current.slice(5)}`),
        ),
      );
  };
  const chooseMonth = (month: number) => {
    if (!unavailable)
      onChange(
        startOfMonth(
          clamp(`${current.slice(0, 4)}-${String(month).padStart(2, "0")}-01`),
        ),
      );
  };

  return (
    <div
      {...props}
      className={[
        "bibbidi-date-picker",
        "bibbidi-date-picker-month-fields",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label={label}
      aria-disabled={unavailable || undefined}
    >
      <DatePickerMonthList
        label="연도"
        disabled={unavailable}
        value={Number(current.slice(0, 4))}
        options={years}
        onChange={chooseYear}
      />
      <DatePickerMonthList
        label="월"
        disabled={unavailable}
        value={Number(current.slice(5, 7))}
        options={months}
        onChange={chooseMonth}
      />
    </div>
  );
}
