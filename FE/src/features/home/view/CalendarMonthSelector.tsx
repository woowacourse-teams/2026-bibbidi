import { useRef, useState } from "react";
import { BottomSheet } from "../../../components/bottom-sheet";
import { Button } from "../../../components/button";
import { DatePicker } from "../../../components/date-picker";
import { ChevronDown } from "../../../components/icons/Chevron";
import { PickerLayer } from "../../../components/picker-layer";
import "./CalendarMonthSelector.css";

export function CalendarMonthSelector({
  value,
  today,
  onSelect,
}: {
  value: string;
  today: string;
  onSelect: (year: number, month: number) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({
    open: false,
    month: `${value.slice(0, 7)}-01`,
  });
  const monthLabel = `${Number(value.slice(0, 4))}년 ${Number(value.slice(5, 7))}월`;

  function changeOpen(open: boolean) {
    setState((current) =>
      open
        ? { open: true, month: `${value.slice(0, 7)}-01` }
        : { ...current, open: false },
    );
  }

  function confirm() {
    onSelect(
      Number(state.month.slice(0, 4)),
      Number(state.month.slice(5, 7)) - 1,
    );
    changeOpen(false);
  }

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      className="calendar-month-selector-trigger"
      aria-label={`${monthLabel}, 연·월 선택`}
    >
      {monthLabel}
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  );
  const picker = (
    <DatePicker.MonthPicker
      ref={pickerRef}
      tabIndex={-1}
      aria-label="캘린더 연·월 선택"
      value={state.month}
      today={today}
      onChange={(month) => setState((current) => ({ ...current, month }))}
    />
  );

  return (
    <PickerLayer
      trigger={trigger}
      title="연·월 선택"
      open={state.open}
      onOpenChange={changeOpen}
      returnFocusRef={triggerRef}
      initialFocusRef={pickerRef}
      showDismiss
      disableChildrenDragging
      footer={(mobile) =>
        mobile ? (
          <BottomSheet.CTA size="large" onClick={confirm}>
            이동
          </BottomSheet.CTA>
        ) : (
          <Button size="large" onClick={confirm}>
            이동
          </Button>
        )
      }
    >
      {picker}
    </PickerLayer>
  );
}
