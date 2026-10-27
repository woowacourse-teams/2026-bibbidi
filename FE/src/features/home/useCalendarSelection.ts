import { useEffect, useState } from "react";
import { addMonths, isDate } from "../../components/date-picker/date-utils";

export function useCalendarSelection(
  referenceDate: string,
  focusDate?: string,
  focusDateRevision?: number,
) {
  const [selectedDate, setSelectedDate] = useState(referenceDate);
  useEffect(() => {
    if (!focusDate || !isDate(focusDate)) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setSelectedDate(focusDate);
    });
    return () => {
      active = false;
    };
  }, [focusDate, focusDateRevision]);
  function selectMonth(year: number, monthIndex: number) {
    const offset =
      (year - Number(selectedDate.slice(0, 4))) * 12 +
      monthIndex -
      (Number(selectedDate.slice(5, 7)) - 1);
    setSelectedDate(addMonths(selectedDate, offset));
  }
  return { selectedDate, selectDate: setSelectedDate, selectMonth };
}
