const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type WeddingDateLoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; date: string | null };

export function isValidWeddingDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1]
  );
}

export function formatLocalDate(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function calendarDayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const utcDate = new Date(0);
  utcDate.setUTCFullYear(year, month - 1, day);
  utcDate.setUTCHours(0, 0, 0, 0);
  return utcDate.getTime() / MILLISECONDS_PER_DAY;
}

export function calculateDaysUntilWedding(
  weddingDate: string,
  today: Date,
): number {
  return (
    calendarDayNumber(weddingDate) - calendarDayNumber(formatLocalDate(today))
  );
}
