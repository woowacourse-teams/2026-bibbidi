import { Badge } from "../../../components/badge";
import { Button } from "../../../components/button";
import { ListHeader } from "../../../components/list-header";
import { ListRow } from "../../../components/list-row";
import type { CalendarScheduleModel } from "../model/homeScheduleDashboard";

import "./CalendarDaySchedules.css";

export function CalendarDaySchedules({
  date,
  schedules,
  status,
  onSelect,
  onRetry,
}: {
  date: string;
  schedules: readonly CalendarScheduleModel[];
  status: "loading" | "error" | "complete";
  onSelect: (id: number) => void;
  onRetry?: () => void;
}) {
  return (
    <section
      className="calendar-day-schedules"
      aria-labelledby="selected-date-title"
    >
      <ListHeader
        headingLevel={3}
        titleId="selected-date-title"
        title={`${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 일정`}
        right={
          status === "complete" && (
            <Badge color="dark" size="xsmall">
              {schedules.length}개
            </Badge>
          )
        }
        description={<time dateTime={date}>{date.slice(0, 4)}년</time>}
      />
      {status === "loading" ? (
        <ListRow.Loader type="bar" aria-label="일정을 불러오는 중이에요." />
      ) : status === "error" ? (
        <div className="calendar-day-schedules__feedback" role="alert">
          <p>일정을 확인하지 못했어요.</p>
          {onRetry && (
            <Button size="small" color="dark" variant="weak" onClick={onRetry}>
              다시 시도
            </Button>
          )}
        </div>
      ) : schedules.length === 0 ? (
        <p className="calendar-day-schedules__empty">
          이 날짜에 등록된 일정이 없어요.
        </p>
      ) : (
        <ul>
          {schedules.map((schedule, index) => (
            <li key={schedule.id}>
              <ListRow
                border={index === 0 ? "none" : "indented"}
                contents={
                  <ListRow.Texts
                    top={schedule.title}
                    bottom={schedule.startTime?.slice(11, 16) || "시간 미정"}
                  />
                }
                withArrow
                onClick={() => onSelect(schedule.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
