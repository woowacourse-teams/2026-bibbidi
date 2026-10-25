import { useId, useLayoutEffect, useRef, useState } from "react";
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
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [anchor, setAnchor] = useState({ value, index: selectedIndex });
  const pendingFocus = useRef(false);
  if (anchor.value !== value) setAnchor({ value, index: selectedIndex });
  const virtual = options.length > 80;
  const start = virtual
    ? Math.max(0, Math.min(anchor.index - 5, options.length - 20))
    : 0;
  const end = virtual ? Math.min(options.length, start + 20) : options.length;
  const selectedVisible = selectedIndex >= start && selectedIndex < end;
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTop = Math.max(
        0,
        20 + selectedIndex * 44 - (viewport.clientHeight - 40) / 2,
      );
      if (pendingFocus.current) {
        viewport
          .querySelector<HTMLButtonElement>(`[data-value="${value}"]`)
          ?.focus({ preventScroll: true });
        pendingFocus.current = false;
      }
    }
  }, [value, selectedIndex]);

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
    pendingFocus.current = true;
    onChange(next.value);
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
        onScroll={(event) => {
          if (virtual)
            setAnchor({
              value,
              index: Math.floor(event.currentTarget.scrollTop / 44),
            });
        }}
        placement={["top", "bottom"]}
        size={20}
      >
        <div
          className="bibbidi-date-picker-month-options"
          style={
            virtual
              ? {
                  paddingTop: 20 + start * 44,
                  paddingBottom: 20 + (options.length - end) * 44,
                }
              : undefined
          }
        >
          {options.slice(start, end).map((option, visibleIndex) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              disabled={disabled || option.disabled}
              tabIndex={
                !disabled &&
                (selectedVisible ? value === option.value : visibleIndex === 0)
                  ? 0
                  : -1
              }
              aria-posinset={start + visibleIndex + 1}
              aria-setsize={options.length}
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
