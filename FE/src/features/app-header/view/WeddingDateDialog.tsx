import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { DatePicker } from "../../../components/date-picker";
import { ConfirmDialog } from "../../../components/dialog";
import { formatLocalDate } from "../model/weddingDate";
import "./WeddingDateDialog.css";

interface WeddingDateDialogProps {
  initialDate: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (date: string) => void;
  saveError: string | null;
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function WeddingDateDialog({
  initialDate,
  isSaving,
  onClose,
  onSave,
  saveError,
  returnFocusRef,
}: WeddingDateDialogProps) {
  const today = formatLocalDate(new Date());
  const startingDate = initialDate ?? today;
  const currentYear = Number(today.slice(0, 4));
  const initialYear = Number(startingDate.slice(0, 4));
  const yearRange = {
    start: Math.max(1, Math.min(currentYear - 100, initialYear)),
    end: Math.min(9999, Math.max(currentYear + 100, initialYear)),
  };
  const [selectedDate, setSelectedDate] = useState(initialDate ?? "");
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLButtonElement | null>(null);
  const errorId = useId();
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const setCalendarRef = useCallback((node: HTMLDivElement | null) => {
    calendarRef.current = node;
    initialFocusRef.current =
      node?.querySelector<HTMLButtonElement>(
        '[role="gridcell"][tabindex="0"]',
      ) ?? null;
  }, []);
  // Saving disables calendar controls; retain focus in the blocking dialog.
  useEffect(() => {
    if (isSaving) calendarRef.current?.closest("dialog")?.focus();
  }, [isSaving, portalContainer]);

  return (
    <div ref={setPortalContainer}>
      {portalContainer && (
        <ConfirmDialog
          open
          onClose={onClose}
          title={<ConfirmDialog.Title>결혼 예정일 설정</ConfirmDialog.Title>}
          aria-busy={isSaving}
          aria-describedby={saveError ? errorId : undefined}
          closeOnEscape={!isSaving}
          closeOnDimmerClick={!isSaving}
          initialFocusRef={initialFocusRef}
          returnFocusRef={returnFocusRef}
          // Keep the modal in its owning Popover so native layers and focus agree.
          portalContainer={portalContainer}
          cancelButton={
            <ConfirmDialog.CancelButton disabled={isSaving} onClick={onClose}>
              취소
            </ConfirmDialog.CancelButton>
          }
          confirmButton={
            <ConfirmDialog.ConfirmButton
              loading={isSaving}
              disabled={!selectedDate || isSaving}
              onClick={() => {
                if (selectedDate) onSave(selectedDate);
              }}
            >
              {isSaving ? "저장 중..." : "저장"}
            </ConfirmDialog.ConfirmButton>
          }
        >
          <div className="app-header-summary__calendar">
            <DatePicker
              ref={setCalendarRef}
              aria-label="결혼 예정일"
              defaultViewDate={startingDate}
              disabled={isSaving}
              onChange={setSelectedDate}
              today={today}
              value={selectedDate}
              yearRange={yearRange}
            />
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
        </ConfirmDialog>
      )}
    </div>
  );
}
