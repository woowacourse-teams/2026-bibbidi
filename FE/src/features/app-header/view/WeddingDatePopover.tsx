import {
  KeyboardEvent,
  RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { formatLocalDate } from "../model/weddingDate";
import "./WeddingDatePopover.css";

interface WeddingDatePopoverProps {
  initialDate: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (date: string) => void;
  saveError: string | null;
  returnFocusRef: RefObject<HTMLElement | null>;
}

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const focusableSelector = "button:not(:disabled)";

function getFocusableElements(container: HTMLElement | null) {
  return Array.from(
    container?.querySelectorAll<HTMLButtonElement>(focusableSelector) ?? [],
  ).filter((element) => element.tabIndex >= 0);
}

function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function formatDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  const lastDay = new Date(0);
  lastDay.setUTCFullYear(year, month, 0);
  return lastDay.getUTCDate();
}

function weekdayOf(date: string) {
  const { year, month, day } = dateParts(date);
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  return value.getUTCDay();
}

function shiftDate(date: string, days: number) {
  const { year, month, day } = dateParts(date);
  const shifted = new Date(0);
  shifted.setUTCFullYear(year, month - 1, day + days);
  return formatDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

export function WeddingDatePopover({
  initialDate,
  isSaving,
  onClose,
  onSave,
  saveError,
  returnFocusRef,
}: WeddingDatePopoverProps) {
  const today = formatLocalDate(new Date());
  const startingDate = initialDate ?? today;
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [focusedDate, setFocusedDate] = useState(startingDate);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const { year, month } = dateParts(startingDate);
    return { year, month };
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const errorId = useId();
  const dayCount = daysInMonth(visibleMonth.year, visibleMonth.month);
  const firstWeekday = weekdayOf(
    formatDate(visibleMonth.year, visibleMonth.month, 1),
  );
  const days = Array.from({ length: dayCount }, (_, index) => index + 1);

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocusTo = returnFocusRef.current;
    const initialDay = dialog?.querySelector<HTMLButtonElement>(
      `[data-date="${startingDate}"]`,
    );
    (initialDay ?? dialog?.querySelector<HTMLButtonElement>("button"))?.focus();

    return () => {
      if (returnFocusTo?.isConnected) {
        queueMicrotask(() => {
          if (!dialog?.isConnected && returnFocusTo.isConnected) {
            returnFocusTo.focus();
          }
        });
      }
    };
  }, [returnFocusRef, startingDate]);

  const moveMonth = (offset: number) => {
    const index = visibleMonth.year * 12 + (visibleMonth.month - 1) + offset;
    const nextYear = Math.floor(index / 12);
    if (nextYear < 1 || nextYear > 9999) {
      return;
    }

    const nextMonth = (index % 12) + 1;
    const focusedDay = dateParts(focusedDate).day;
    const nextDay = Math.min(focusedDay, daysInMonth(nextYear, nextMonth));
    setVisibleMonth({ month: nextMonth, year: nextYear });
    setFocusedDate(formatDate(nextYear, nextMonth, nextDay));
  };

  const moveFocus = (date: string) => {
    const { year, month } = dateParts(date);
    setVisibleMonth({ year, month });
    setFocusedDate(date);
    requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)
        ?.focus();
    });
  };

  const handleDayKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    date: string,
  ) => {
    const weekday = weekdayOf(date);
    const offset =
      event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowRight"
          ? 1
          : event.key === "ArrowUp"
            ? -7
            : event.key === "ArrowDown"
              ? 7
              : event.key === "Home"
                ? -weekday
                : event.key === "End"
                  ? 6 - weekday
                  : null;
    if (offset !== null) {
      event.preventDefault();
      moveFocus(shiftDate(date, offset));
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const handleDialogKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!isSaving) {
          onClose();
        }
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(dialog);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    dialog.addEventListener("keydown", handleDialogKeyDown);
    return () => dialog.removeEventListener("keydown", handleDialogKeyDown);
  }, [isSaving, onClose]);

  return (
    <>
      <div
        className="app-header-summary__popover-backdrop"
        onPointerDown={() => {
          if (!isSaving) {
            onClose();
          }
        }}
      />
      <div
        aria-describedby={saveError ? errorId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="app-header-summary__popover"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 id={titleId}>결혼 예정일 설정</h2>
        <div className="app-header-summary__calendar-navigation">
          <button
            aria-label="이전 연도"
            onClick={() => moveMonth(-12)}
            type="button"
          >
            «
          </button>
          <button
            aria-label="이전 달"
            onClick={() => moveMonth(-1)}
            type="button"
          >
            ‹
          </button>
          <strong aria-live="polite">
            {visibleMonth.year}년 {visibleMonth.month}월
          </strong>
          <button
            aria-label="다음 달"
            onClick={() => moveMonth(1)}
            type="button"
          >
            ›
          </button>
          <button
            aria-label="다음 연도"
            onClick={() => moveMonth(12)}
            type="button"
          >
            »
          </button>
        </div>
        <div
          aria-label={`${visibleMonth.year}년 ${visibleMonth.month}월 날짜`}
          className="app-header-summary__calendar"
          role="group"
        >
          {weekdays.map((weekday) => (
            <span
              aria-hidden="true"
              className="app-header-summary__weekday"
              key={weekday}
            >
              {weekday}
            </span>
          ))}
          {Array.from({ length: firstWeekday }, (_, index) => (
            <span aria-hidden="true" key={`blank-${index}`} />
          ))}
          {days.map((day) => {
            const date = formatDate(visibleMonth.year, visibleMonth.month, day);
            return (
              <button
                aria-current={date === today ? "date" : undefined}
                aria-label={`${visibleMonth.year}년 ${visibleMonth.month}월 ${day}일`}
                aria-pressed={date === selectedDate}
                className="app-header-summary__calendar-day"
                data-date={date}
                key={date}
                onClick={() => {
                  setSelectedDate(date);
                  setFocusedDate(date);
                }}
                onFocus={() => setFocusedDate(date)}
                onKeyDown={(event) => handleDayKeyDown(event, date)}
                tabIndex={date === focusedDate ? 0 : -1}
                type="button"
              >
                {day}
              </button>
            );
          })}
        </div>
        <p className="app-header-summary__selection" role="status">
          {selectedDate
            ? `선택한 날짜: ${selectedDate}`
            : "날짜를 선택해 주세요."}
        </p>
        {saveError ? (
          <p className="app-header-summary__error" id={errorId} role="alert">
            {saveError}
          </p>
        ) : null}
        <div className="app-header-summary__popover-actions">
          <button disabled={isSaving} onClick={onClose} type="button">
            취소
          </button>
          <button
            disabled={selectedDate === null || isSaving}
            onClick={() => {
              if (selectedDate !== null) {
                onSave(selectedDate);
              }
            }}
            type="button"
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </>
  );
}
