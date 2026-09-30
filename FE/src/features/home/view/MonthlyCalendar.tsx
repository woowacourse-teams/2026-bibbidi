import { useMemo, useState } from "react";

import { CalendarScheduleModel } from "../model/homeScheduleDashboard";
import "./MonthlyCalendar.css";

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const CALENDAR_CELL_COUNT = 42;

interface MonthlyCalendarProps {
  referenceDate: string;
  schedules?: readonly CalendarScheduleModel[];
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function CalendarArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

export function MonthlyCalendar({
  referenceDate,
  schedules = [],
}: MonthlyCalendarProps) {
  const today = useMemo(() => parseLocalDate(referenceDate), [referenceDate]);
  const schedulesByDate = useMemo(() => {
    const groupedSchedules = new Map<string, CalendarScheduleModel[]>();

    for (const schedule of schedules) {
      const currentSchedules = groupedSchedules.get(schedule.date) ?? [];
      currentSchedules.push(schedule);
      groupedSchedules.set(schedule.date, currentSchedules);
    }

    return groupedSchedules;
  }, [schedules]);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const cells = Array.from({ length: CALENDAR_CELL_COUNT }, (_, index) => {
    const firstDay = new Date(year, month, 1).getDay();
    return new Date(year, month, index - firstDay + 1);
  });

  const moveMonth = (offset: number) => {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  };

  return (
    <section
      aria-labelledby="monthly-calendar-title"
      className="monthly-calendar"
    >
      <header className="monthly-calendar__header">
        <div>
          <div className="monthly-calendar__title">
            <h2 id="monthly-calendar-title">캘린더</h2>
            <span>
              체크리스트에서 일정을 추가하면 캘린더에서 확인할 수 있어요.
            </span>
          </div>
          <p aria-live="polite">{`${year}년 ${month + 1}월`}</p>
        </div>
        <div aria-label="월 이동" className="monthly-calendar__controls">
          <button
            aria-label="이전 달"
            onClick={() => moveMonth(-1)}
            type="button"
          >
            <CalendarArrowIcon direction="left" />
          </button>
          <button
            className="monthly-calendar__today-button"
            onClick={() =>
              setVisibleMonth(
                new Date(today.getFullYear(), today.getMonth(), 1),
              )
            }
            type="button"
          >
            오늘
          </button>
          <button
            aria-label="다음 달"
            onClick={() => moveMonth(1)}
            type="button"
          >
            <CalendarArrowIcon direction="right" />
          </button>
        </div>
      </header>

      <table className="monthly-calendar__grid">
        <caption>{`${year}년 ${month + 1}월 달력`}</caption>
        <thead>
          <tr>
            {DAYS_OF_WEEK.map((day) => (
              <th key={day} scope="col">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, weekIndex) => (
            <tr key={weekIndex}>
              {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => {
                const isCurrentMonth = date.getMonth() === month;
                const isToday = isSameDate(date, today);
                const dateTime = formatDateTime(date);
                const dateSchedules = schedulesByDate.get(dateTime) ?? [];
                const visibleSchedules = dateSchedules.slice(0, 2);
                const remainingScheduleCount =
                  dateSchedules.length - visibleSchedules.length;
                return (
                  <td
                    className={[
                      !isCurrentMonth && "monthly-calendar__day--outside",
                      isToday && "monthly-calendar__day--today",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={dateTime}
                  >
                    <time
                      aria-current={isToday ? "date" : undefined}
                      aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일${isToday ? ", 오늘" : ""}`}
                      dateTime={dateTime}
                    >
                      {date.getDate()}
                    </time>
                    {visibleSchedules.length > 0 && (
                      <ul
                        aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일 일정`}
                        className="monthly-calendar__schedules"
                      >
                        {visibleSchedules.map((schedule) => (
                          <li key={schedule.id}>
                            <span
                              aria-hidden="true"
                              className="monthly-calendar__schedule-dot"
                            />
                            <span className="monthly-calendar__schedule-title">
                              {schedule.title}
                            </span>
                          </li>
                        ))}
                        {remainingScheduleCount > 0 && (
                          <li className="monthly-calendar__schedule-more">
                            +{remainingScheduleCount}
                          </li>
                        )}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
