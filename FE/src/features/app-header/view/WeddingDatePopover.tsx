import { RefObject, useEffect, useId, useRef, useState } from "react";

import { Button } from "../../../components/button";
import { DatePicker } from "../../../components/date-picker";
import { containTabFocus } from "../../../shared/focus/containTabFocus";
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
  const currentYear = Number(today.slice(0, 4));
  const initialYear = Number(startingDate.slice(0, 4));
  // Use the design-system range while keeping any previously saved date selectable.
  const yearRange = {
    start: Math.max(1, Math.min(currentYear - 100, initialYear)),
    end: Math.min(9999, Math.max(currentYear + 100, initialYear)),
  };
  const [selectedDate, setSelectedDate] = useState(initialDate ?? "");
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const errorId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocusTo = returnFocusRef.current;
    dialog
      ?.querySelector<HTMLButtonElement>('[role="gridcell"][tabindex="0"]')
      ?.focus();

    return () => {
      queueMicrotask(() => {
        if (!dialog?.isConnected && returnFocusTo?.isConnected) {
          returnFocusTo.focus();
        }
      });
    };
  }, [returnFocusRef, startingDate]);

  useEffect(() => {
    if (isSaving) dialogRef.current?.focus();
  }, [isSaving]);

  return (
    <>
      <div
        className="app-header-summary__popover-backdrop"
        onPointerDown={() => {
          if (!isSaving) onClose();
        }}
      />
      {/* The dialog contains keyboard focus and handles Escape from its controls. */}
      {/* eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions */}
      <div
        aria-busy={isSaving}
        aria-describedby={saveError ? errorId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="app-header-summary__popover"
        onKeyDown={(event) => {
          if (event.defaultPrevented) return;
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (!isSaving) onClose();
          } else {
            containTabFocus(event, event.currentTarget);
          }
        }}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 id={titleId}>결혼 예정일 설정</h2>
        <DatePicker
          aria-label="결혼 예정일"
          defaultViewDate={startingDate}
          disabled={isSaving}
          onChange={setSelectedDate}
          today={today}
          value={selectedDate}
          yearRange={yearRange}
        />
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
          <Button
            color="dark"
            variant="weak"
            size="medium"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            취소
          </Button>
          <Button
            size="medium"
            loading={isSaving}
            disabled={!selectedDate || isSaving}
            onClick={() => {
              if (selectedDate) onSave(selectedDate);
            }}
            type="button"
          >
            {isSaving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </>
  );
}
