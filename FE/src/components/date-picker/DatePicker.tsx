import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ComponentPropsWithRef, KeyboardEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "../icons/Chevron";
import {
  addDays,
  addMonths,
  dateLabel,
  dateObject,
  endOfMonth,
  isDate,
  localToday,
  monthLabel,
  monthWeeks,
  startOfMonth,
} from "./date-utils";
import { DatePickerMonthPicker } from "./DatePickerMonthPicker";
import "./DatePicker.css";

export type DatePickerRange = { start: string; end?: string };
export type DatePickerSelectionMode = "single" | "range" | "multiple";
type SelectionProps =
  | {
      selectionMode?: "single";
      value?: string;
      defaultValue?: string;
      onChange?: (value: string) => void;
    }
  | {
      selectionMode: "range";
      value?: DatePickerRange | null;
      defaultValue?: DatePickerRange | null;
      onChange?: (value: DatePickerRange) => void;
    }
  | {
      selectionMode: "multiple";
      value?: string[];
      defaultValue?: string[];
      onChange?: (value: string[]) => void;
    };
export type DatePickerProps = Omit<
  ComponentPropsWithRef<"div">,
  "defaultValue" | "onChange" | "children"
> &
  SelectionProps & {
    today?: string;
    defaultViewDate?: string;
    minDate?: string;
    maxDate?: string;
    isDateDisabled?: (date: string) => boolean;
    disabled?: boolean;
    readOnly?: boolean;
    numberOfMonths?: 1 | 2;
    weekStartsOn?: 0 | 1;
    yearRange?: { start: number; end: number };
  };

type Value = string | DatePickerRange | string[] | null;
function selectedDates(value: Value): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value;
  return [value.start, ...(value.end ? [value.end] : [])];
}

/** An inline calendar. Values are calendar dates in YYYY-MM-DD format. */
function DatePickerRoot(props: DatePickerProps) {
  const {
    selectionMode = "single",
    value,
    defaultValue,
    onChange,
    today = localToday(),
    defaultViewDate,
    minDate,
    maxDate,
    isDateDisabled,
    disabled = false,
    readOnly = false,
    numberOfMonths = 1,
    weekStartsOn = 0,
    yearRange = {
      start: Number(today.slice(0, 4)) - 100,
      end: Number(today.slice(0, 4)) + 100,
    },
    className,
    "aria-label": ariaLabel = "날짜 선택",
    "aria-labelledby": labelledBy,
    "aria-disabled": ariaDisabled,
    ...rest
  } = props;
  const unavailable =
    disabled || ariaDisabled === true || ariaDisabled === "true";
  const [internalValue, setInternalValue] = useState<Value>(
    () => defaultValue ?? (selectionMode === "multiple" ? [] : null),
  );
  const current = value === undefined ? internalValue : value;
  const dates = selectedDates(current).filter(isDate).sort();
  const range =
    selectionMode === "range" &&
    current &&
    typeof current === "object" &&
    !Array.isArray(current)
      ? current
      : null;
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
  const initial = clamp(
    defaultViewDate && isDate(defaultViewDate)
      ? defaultViewDate
      : (dates[0] ?? today),
  );
  const [storedView, setView] = useState(() => startOfMonth(initial));
  const view = startOfMonth(clamp(storedView));
  const [focused, setFocused] = useState(initial);
  const [pickingMonth, setPickingMonth] = useState(false);
  const selectionKey = dates.join(",");
  const [previousSelection, setPreviousSelection] = useState(selectionKey);
  const [requestedSelection, setRequestedSelection] = useState<string | null>(
    null,
  );

  if (previousSelection !== selectionKey) {
    setPreviousSelection(selectionKey);
    setRequestedSelection(null);
    // Parent updates to our own selection must preserve month/range navigation.
    if (
      value !== undefined &&
      selectionKey !== requestedSelection &&
      dates[0]
    ) {
      const nextDate = clamp(dates[0]);
      setView(startOfMonth(nextDate));
      setFocused(nextDate);
    }
  }

  const gridRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  const monthPanelRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  const headingId = useId();
  const panelId = useId();
  const visible = Array.from({ length: numberOfMonths }, (_, i) =>
    addMonths(view, i),
  ).filter((month) => isDate(month) && month <= startOfMonth(upper));
  const firstVisible = visible[0];
  const lastVisible = endOfMonth(visible.at(-1)!);
  const entryDate = clamp(
    focused >= firstVisible && focused <= lastVisible ? focused : firstVisible,
  );
  const blocked = (date: string) =>
    date < lower || date > upper || Boolean(isDateDisabled?.(date));
  const rangeBlocked = (date: string) => {
    if (blocked(date)) return true;
    if (range?.start && !range.end && date >= range.start) {
      for (let candidate = range.start; ; candidate = addDays(candidate, 1)) {
        if (blocked(candidate)) return true;
        if (candidate === date) break;
      }
    }
    return false;
  };

  useLayoutEffect(() => {
    if (pendingFocus.current && !pickingMonth) {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)
        ?.focus();
      pendingFocus.current = false;
    }
  });
  useLayoutEffect(() => {
    if (pickingMonth)
      monthPanelRef.current
        ?.querySelector<HTMLButtonElement>(
          '[role="option"][aria-selected="true"]',
        )
        ?.focus({ preventScroll: true });
  }, [pickingMonth]);

  function commit(next: Value) {
    if (value === undefined) setInternalValue(next);
    else
      setRequestedSelection(
        selectedDates(next).filter(isDate).sort().join(","),
      );
    if (props.selectionMode === "range")
      props.onChange?.(next as DatePickerRange);
    else if (props.selectionMode === "multiple")
      props.onChange?.(next as string[]);
    else (onChange as ((value: string) => void) | undefined)?.(next as string);
  }
  function choose(date: string) {
    if (unavailable || readOnly || rangeBlocked(date)) return;
    if (selectionMode === "multiple") {
      commit(
        dates.includes(date)
          ? dates.filter((selected) => selected !== date)
          : [...dates, date].sort(),
      );
    } else if (selectionMode === "range") {
      if (!range || range.end || date < range.start) commit({ start: date });
      else commit({ start: range.start, end: date });
    } else if (current !== date) commit(date);
  }
  function moveFocus(date: string) {
    const target = clamp(date);
    if (target === focused) return;
    pendingFocus.current = true;
    setFocused(target);
    if (target < firstVisible || target > lastVisible)
      setView(startOfMonth(target));
  }
  function onDateKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    date: string,
  ) {
    const weekday = (dateObject(date).getUTCDay() - weekStartsOn + 7) % 7;
    const targets: Record<string, () => string> = {
      ArrowLeft: () => addDays(date, -1),
      ArrowRight: () => addDays(date, 1),
      ArrowUp: () => addDays(date, -7),
      ArrowDown: () => addDays(date, 7),
      Home: () => addDays(date, -weekday),
      End: () => addDays(date, 6 - weekday),
      PageUp: () => addMonths(date, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(date, event.shiftKey ? 12 : 1),
    };
    if (targets[event.key]) {
      event.preventDefault();
      moveFocus(targets[event.key]());
    }
  }
  function navigate(count: number) {
    const next = startOfMonth(clamp(addMonths(view, count)));
    setView(next);
    setFocused(clamp(next));
  }
  function closeMonthPicker() {
    setPickingMonth(false);
    titleRef.current?.focus();
  }

  return (
    <div
      {...rest}
      className={["bibbidi-date-picker", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      role="group"
      aria-disabled={unavailable || undefined}
      data-disabled={unavailable || undefined}
      data-readonly={readOnly || undefined}
    >
      <div className="bibbidi-date-picker-header">
        <button
          ref={titleRef}
          type="button"
          className="bibbidi-date-picker-title"
          disabled={unavailable}
          aria-expanded={pickingMonth}
          aria-controls={panelId}
          onClick={() => setPickingMonth(!pickingMonth)}
        >
          <span id={headingId} aria-live="polite" aria-atomic="true">
            {monthLabel(view)}
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            data-open={pickingMonth || undefined}
          />
        </button>
        <div className="bibbidi-date-picker-navigation">
          <button
            type="button"
            aria-label="이전 달"
            disabled={unavailable || view <= startOfMonth(lower)}
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="다음 달"
            disabled={
              unavailable ||
              !isDate(addMonths(view, numberOfMonths)) ||
              addMonths(view, numberOfMonths) > startOfMonth(upper)
            }
            onClick={() => navigate(1)}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div id={panelId}>
        {pickingMonth ? (
          // Escape is delegated from the year/month options and return button.
          // eslint-disable-next-line jsx-a11y-x/no-static-element-interactions
          <div
            className="bibbidi-date-picker-month-panel"
            ref={monthPanelRef}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeMonthPicker();
              }
            }}
          >
            <DatePickerMonthPicker
              value={view}
              today={today}
              yearRange={yearRange}
              minDate={lower}
              maxDate={upper}
              disabled={unavailable}
              onChange={(next) => {
                setView(next);
                setFocused(clamp(next));
              }}
            />
            <button
              type="button"
              className="bibbidi-date-picker-return"
              disabled={unavailable}
              onClick={closeMonthPicker}
            >
              날짜 선택으로 돌아가기
            </button>
          </div>
        ) : (
          <div
            className="bibbidi-date-picker-months"
            ref={gridRef}
            data-months={numberOfMonths}
          >
            {visible.map((month, monthIndex) => (
              <div key={month} className="bibbidi-date-picker-month">
                {numberOfMonths === 2 && (
                  <p className="bibbidi-date-picker-month-label">
                    {monthLabel(month)}
                  </p>
                )}
                <div
                  role="grid"
                  aria-label={monthLabel(month)}
                  aria-multiselectable={selectionMode !== "single" || undefined}
                  aria-readonly={readOnly || undefined}
                >
                  <div role="row" className="bibbidi-date-picker-weekdays">
                    {Array.from(
                      { length: 7 },
                      (_, i) => (i + weekStartsOn) % 7,
                    ).map((day) => (
                      <span role="columnheader" key={day}>
                        {["일", "월", "화", "수", "목", "금", "토"][day]}
                      </span>
                    ))}
                  </div>
                  {monthWeeks(month, weekStartsOn).map((week, weekIndex) => (
                    <div
                      role="row"
                      className="bibbidi-date-picker-week"
                      key={weekIndex}
                    >
                      {week.map((date, dayIndex) => {
                        if (!date)
                          return (
                            <span key={`empty-${dayIndex}`} role="gridcell" />
                          );
                        const selected = dates.includes(date);
                        const inRange = Boolean(
                          range?.end &&
                          date >= range.start &&
                          date <= range.end,
                        );
                        const isBlocked = rangeBlocked(date);
                        return (
                          <button
                            key={date}
                            type="button"
                            role="gridcell"
                            data-date={date}
                            className="bibbidi-date-picker-day"
                            tabIndex={
                              !unavailable && date === entryDate ? 0 : -1
                            }
                            disabled={unavailable}
                            aria-selected={selected || inRange}
                            aria-disabled={
                              unavailable || isBlocked || undefined
                            }
                            aria-current={date === today ? "date" : undefined}
                            aria-label={dateLabel(date)}
                            data-today={date === today || undefined}
                            data-selected={selected || undefined}
                            data-in-range={inRange || undefined}
                            data-range-start={
                              (inRange && date === range?.start) || undefined
                            }
                            data-range-end={
                              (inRange && date === range?.end) || undefined
                            }
                            onFocus={() => setFocused(date)}
                            onClick={() => choose(date)}
                            onKeyDown={(event) => onDateKeyDown(event, date)}
                          >
                            <span>{Number(date.slice(8))}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {monthIndex === 0 && (
                  <span
                    className="bibbidi-date-picker-sr-only"
                    aria-live="polite"
                  >
                    {readOnly
                      ? "읽기 전용"
                      : selectionMode === "range"
                        ? range?.start && !range.end
                          ? "종료일을 선택하세요."
                          : "시작일을 선택하세요."
                        : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const DatePicker = Object.assign(DatePickerRoot, {
  MonthPicker: DatePickerMonthPicker,
});
