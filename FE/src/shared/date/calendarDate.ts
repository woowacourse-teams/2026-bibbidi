/** Calendar-only ISO dates; all arithmetic uses UTC and never parses local time. */
export function dateObject(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

export function dateKey(date: Date) {
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function isDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value.slice(0, 4) !== "0000" &&
    dateKey(dateObject(value)) === value
  );
}

export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function addDays(value: string, days: number) {
  const date = dateObject(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

export function startOfMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

export function endOfMonth(value: string) {
  const date = dateObject(startOfMonth(value));
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return dateKey(date);
}

export function addMonths(value: string, count: number) {
  const date = dateObject(startOfMonth(value));
  date.setUTCMonth(date.getUTCMonth() + count);
  const last = new Date(date.getTime());
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(Number(value.slice(8)), last.getUTCDate()));
  return dateKey(date);
}

export function monthLabel(value: string) {
  return `${Number(value.slice(0, 4))}년 ${Number(value.slice(5, 7))}월`;
}

export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(dateObject(value));
}

export function monthWeeks(value: string, weekStartsOn: number) {
  const first = startOfMonth(value);
  const offset = (dateObject(first).getUTCDay() - weekStartsOn + 7) % 7;
  const days = dateObject(endOfMonth(first)).getUTCDate();
  const cells = Array.from(
    { length: Math.ceil((offset + days) / 7) * 7 },
    (_, i) =>
      i < offset || i >= offset + days ? null : addDays(first, i - offset),
  );
  return Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );
}

/** Intersects the caller's date limits with the supported year range. */
export function getDateBounds({
  today,
  yearRange = {
    start: Number(today.slice(0, 4)) - 100,
    end: Number(today.slice(0, 4)) + 100,
  },
  minDate,
  maxDate,
}: {
  today: string;
  yearRange?: { start: number; end: number };
  minDate?: string;
  maxDate?: string;
}) {
  const earliest = `${String(Math.max(1, yearRange.start)).padStart(4, "0")}-01-01`;
  const latest = `${String(Math.min(9999, yearRange.end)).padStart(4, "0")}-12-31`;
  const lower = minDate && minDate > earliest ? minDate : earliest;
  const upper = maxDate && maxDate < latest ? maxDate : latest;
  return {
    lower,
    upper,
    clamp: (date: string) =>
      dateObject(date) < dateObject(lower)
        ? lower
        : dateObject(date) > dateObject(upper)
          ? upper
          : date,
  };
}
