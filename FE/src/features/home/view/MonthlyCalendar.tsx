import { IconButton } from "../../../components/icon-button";
import { ChevronLeft, ChevronRight } from "../../../components/icons/Chevron";
import {
  addDays,
  dateObject,
  isDate,
  monthLabel,
  startOfMonth,
} from "../../../shared/date/calendarDate";
import { useIsMobileLayout } from "../../../shared/responsive";
import type { CalendarScheduleModel } from "../model/calendarSchedule";
import { CalendarMonthSelector } from "./CalendarMonthSelector";
import "./MonthlyCalendar.css";

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

interface MonthlyCalendarProps {
  referenceDate: string;
  selectedDate: string;
  schedulesByDate: ReadonlyMap<string, readonly CalendarScheduleModel[]>;
  onSelectDate: (date: string) => void;
  onSelectMonth: (year: number, monthIndex: number) => void;
  onSelectSchedule: (id: number) => void;
}

/** Calendar display; the planning screen owns selection and adjacent content. */
export function MonthlyCalendar({
  referenceDate,
  selectedDate,
  schedulesByDate,
  onSelectDate,
  onSelectMonth,
  onSelectSchedule,
}: MonthlyCalendarProps) {
  const isMobileLayout = useIsMobileLayout();
  const year = Number(selectedDate.slice(0, 4));
  const month = Number(selectedDate.slice(5, 7)) - 1;
  const first = startOfMonth(selectedDate);
  const offset = dateObject(first).getUTCDay();
  const cells = Array.from({ length: 42 }, (_, index) =>
    addDays(first, index - offset),
  );
  return (
    <section
      aria-labelledby="monthly-calendar-title"
      className="monthly-calendar"
    >
      <header className="monthly-calendar__header">
        <div>
          <h2
            id="monthly-calendar-title"
            aria-live="polite"
            className="monthly-calendar__heading--hidden"
          >
            {monthLabel(selectedDate)}
          </h2>
          <CalendarMonthSelector
            value={selectedDate}
            today={referenceDate}
            onSelect={onSelectMonth}
          />
        </div>
        <div aria-label="월 이동" className="monthly-calendar__controls">
          <IconButton
            aria-label="이전 달"
            icon={<ChevronLeft />}
            iconSize={20}
            disabled={selectedDate.slice(0, 7) === "0001-01"}
            onClick={() => onSelectMonth(year, month - 1)}
          />
          <IconButton
            aria-label="다음 달"
            icon={<ChevronRight />}
            iconSize={20}
            disabled={selectedDate.slice(0, 7) === "9999-12"}
            onClick={() => onSelectMonth(year, month + 1)}
          />
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
              {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((dateTime) => {
                if (!isDate(dateTime)) return <td key={dateTime} />;
                const date = dateObject(dateTime);
                const isCurrentMonth = date.getUTCMonth() === month;
                const isToday = dateTime === referenceDate;
                const dateSchedules = schedulesByDate.get(dateTime) ?? [];
                const visibleSchedules = dateSchedules.slice(0, 1);
                const remainingScheduleCount =
                  dateSchedules.length - visibleSchedules.length;
                return (
                  <td
                    className={[
                      !isCurrentMonth && "monthly-calendar__day--outside",
                      isToday && "monthly-calendar__day--today",
                      selectedDate === dateTime &&
                        "monthly-calendar__day--selected",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={dateTime}
                  >
                    <button
                      type="button"
                      className="monthly-calendar__date-button"
                      aria-pressed={selectedDate === dateTime}
                      onClick={() => onSelectDate(dateTime)}
                    >
                      <time
                        aria-current={isToday ? "date" : undefined}
                        aria-label={`${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일${isToday ? ", 오늘" : ""}`}
                        dateTime={dateTime}
                      >
                        {date.getUTCDate()}
                      </time>
                    </button>
                    {visibleSchedules.length > 0 && (
                      <ul
                        aria-label={`${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 일정`}
                        className="monthly-calendar__schedules"
                      >
                        {visibleSchedules.map((schedule) => (
                          <li key={schedule.id}>
                            <span
                              aria-hidden="true"
                              className="monthly-calendar__schedule-dot"
                            />
                            {!isMobileLayout ? (
                              <button
                                type="button"
                                className="monthly-calendar__schedule-title"
                                onClick={() => onSelectSchedule(schedule.id)}
                                title={schedule.title}
                              >
                                {schedule.startTime?.slice(11, 16)}{" "}
                                {schedule.title}
                              </button>
                            ) : (
                              <span className="monthly-calendar__schedule-title">
                                {schedule.title}
                              </span>
                            )}
                          </li>
                        ))}
                        {remainingScheduleCount > 0 && (
                          <li className="monthly-calendar__schedule-more">
                            +{remainingScheduleCount}개
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
