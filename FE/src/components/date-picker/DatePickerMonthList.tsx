import { useId, useLayoutEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { ScrollFog } from "../scroll-fog";

type MonthOption = { value: number; label: string; disabled?: boolean };
interface DatePickerMonthListProps {
  label: string;
  value: number;
  options: MonthOption[];
  disabled: boolean;
  onChange: (value: number) => void;
}

/** A single-selection column shared by the year and month controls. */
export function DatePickerMonthList({
  label,
  value,
  options,
  disabled,
  onChange,
}: DatePickerMonthListProps) {
  const labelId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const selected = selectedRef.current;
    if (viewport && selected)
      viewport.scrollTop =
        selected.offsetTop -
        (viewport.clientHeight - selected.offsetHeight) / 2;
  }, [value]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    const available = options.filter((option) => !option.disabled);
    const index = available.findIndex((option) => option.value === current);
    const destinations: Record<string, number> = {
      ArrowUp: Math.max(0, index - 1),
      ArrowDown: Math.min(available.length - 1, index + 1),
      Home: 0,
      End: available.length - 1,
      PageUp: Math.max(0, index - 5),
      PageDown: Math.min(available.length - 1, index + 5),
    };
    if (!(event.key in destinations) || disabled) return;
    event.preventDefault();
    const next = available[destinations[event.key]];
    if (!next) return;
    onChange(next.value);
    viewportRef.current
      ?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)
      ?.focus({ preventScroll: true });
  }

  return (
    <div className="bibbidi-date-picker-month-field">
      <span id={labelId}>{label}</span>
      <ScrollFog
        ref={viewportRef}
        className="bibbidi-date-picker-month-list"
        role="listbox"
        aria-labelledby={labelId}
        aria-disabled={disabled || undefined}
        tabIndex={-1}
        placement={["top", "bottom"]}
        size={20}
      >
        <div className="bibbidi-date-picker-month-options">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              disabled={disabled || option.disabled}
              tabIndex={!disabled && value === option.value ? 0 : -1}
              ref={value === option.value ? selectedRef : undefined}
              data-value={option.value}
              onKeyDown={(event) => onKeyDown(event, option.value)}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </ScrollFog>
    </div>
  );
}
