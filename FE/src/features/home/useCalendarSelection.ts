import { useEffect, useState } from "react";
import {
  addMonths,
  getDateBounds,
  isDate,
} from "../../shared/date/calendarDate";
import { SCHEDULE_YEAR_RANGE } from "../../shared/date/scheduleDate";

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
    const { clamp } = getDateBounds({
      today: referenceDate,
      yearRange: SCHEDULE_YEAR_RANGE,
    });
    setSelectedDate(clamp(addMonths(selectedDate, offset)));
  }
  return { selectedDate, selectDate: setSelectedDate, selectMonth };
}
