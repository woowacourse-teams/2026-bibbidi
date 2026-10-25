import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ComponentPropsWithRef, KeyboardEvent } from "react";
import { roundTimeToStep } from "./time-utils";
import type { TimePickerMinuteStep } from "./time-utils";
import "./TimePicker.css";

export type TimePickerProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "onChange" | "defaultValue" | "role"
> & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  minuteStep?: TimePickerMinuteStep;
  disabled?: boolean;
  readOnly?: boolean;
};

type WheelProps = {
  label: string;
  options: string[];
  index: number;
  onChange: (index: number) => void;
  disabled: boolean;
  readOnly: boolean;
};

function Wheel({
  label,
  options,
  index,
  onChange,
  disabled,
  readOnly,
}: WheelProps) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrolling = useRef(false);
  const [revision, refresh] = useReducer((n: number) => n + 1, 0);
  const latest = useRef({
    index,
    onChange,
    disabled,
    readOnly,
    count: options.length,
  });
  useLayoutEffect(() => {
    latest.current = {
      index,
      onChange,
      disabled,
      readOnly,
      count: options.length,
    };
  });
  const rowHeight = () =>
    ref.current?.firstElementChild?.getBoundingClientRect().height || 44;
  const align = useCallback(() => {
    const node = ref.current;
    if (node)
      node.scrollTop =
        latest.current.index *
        (node.firstElementChild?.getBoundingClientRect().height || 44);
  }, []);

  useLayoutEffect(() => {
    if (!scrolling.current) {
      clearTimeout(timer.current);
      align();
    }
  }, [align, index, options.length, disabled, readOnly, revision]);
  useLayoutEffect(() => {
    // Popover and dialog children can mount before their panel becomes visible.
    const observer = new ResizeObserver(() => {
      if (!scrolling.current) align();
    });
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, [align]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function choose(next: number) {
    scrolling.current = false;
    clearTimeout(timer.current);
    const current = latest.current;
    if (!current.disabled && !current.readOnly) current.onChange(next);
    refresh(); // Also restore the wheel when a controlled parent rejects a change.
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: 5,
      PageUp: -5,
    };
    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else if (event.key in delta)
      next = Math.max(
        0,
        Math.min(options.length - 1, index + delta[event.key]),
      );
    else return;
    event.preventDefault();
    choose(next);
  }

  return (
    <div
      ref={ref}
      className="bibbidi-time-picker-wheel"
      role="listbox"
      aria-label={label}
      aria-activedescendant={`${id}-${index}`}
      aria-disabled={disabled || undefined}
      aria-readonly={readOnly || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      onScroll={() => {
        clearTimeout(timer.current);
        if (latest.current.disabled || latest.current.readOnly) {
          align();
          return;
        }
        const node = ref.current;
        if (!node) return;
        const next = Math.max(
          0,
          Math.min(
            latest.current.count - 1,
            Math.round(node.scrollTop / rowHeight()),
          ),
        );
        // Publish immediately so a following confirmation sees the visible time.
        // Only snapping waits for scrolling to settle.
        scrolling.current = true;
        if (next !== latest.current.index) latest.current.onChange(next);
        timer.current = setTimeout(() => {
          scrolling.current = false;
          refresh();
        }, 120);
      }}
    >
      {options.map((option, optionIndex) => (
        <button
          key={option}
          type="button"
          tabIndex={-1}
          disabled={disabled}
          id={`${id}-${optionIndex}`}
          role="option"
          aria-selected={optionIndex === index}
          className="bibbidi-time-picker-item"
          onClick={() => {
            if (!disabled) {
              ref.current?.focus({ preventScroll: true });
              choose(optionIndex);
            }
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

const hours = ["12", ...Array.from({ length: 11 }, (_, i) => String(i + 1))];

export function TimePicker({
  value,
  defaultValue = "00:00",
  onChange,
  minuteStep = 5,
  disabled = false,
  readOnly = false,
  className,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...props
}: TimePickerProps) {
  const [internal, setInternal] = useState(() =>
    roundTimeToStep(defaultValue, minuteStep),
  );
  const selected = roundTimeToStep(value ?? internal, minuteStep);
  const [hour, minute] = selected.split(":").map(Number);
  const minutes = Array.from({ length: 60 / minuteStep }, (_, i) =>
    String(i * minuteStep).padStart(2, "0"),
  );
  function update(nextHour: number, nextMinute: number) {
    if (disabled || readOnly) return;
    const next = `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }
  const shared = { disabled, readOnly };
  return (
    <div
      {...props}
      role="group"
      aria-label={label ?? (labelledBy ? undefined : "시간 선택")}
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      className={["bibbidi-time-picker", className].filter(Boolean).join(" ")}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
    >
      <div className="bibbidi-time-picker-indicator" aria-hidden="true" />
      <Wheel
        {...shared}
        label="오전·오후"
        options={["오전", "오후"]}
        index={hour < 12 ? 0 : 1}
        onChange={(period) => update((hour % 12) + period * 12, minute)}
      />
      <Wheel
        {...shared}
        label="시"
        options={hours}
        index={hour % 12}
        onChange={(next) => update(next + (hour >= 12 ? 12 : 0), minute)}
      />
      <Wheel
        {...shared}
        label="분"
        options={minutes}
        index={minute / minuteStep}
        onChange={(next) => update(hour, next * minuteStep)}
      />
    </div>
  );
}
