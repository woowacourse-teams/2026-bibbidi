import { useMemo, useState } from "react";
import { useCalendarSelection } from "../useCalendarSelection";
import { CalendarDaySchedules } from "./CalendarDaySchedules";
import { CalendarScheduleDetail } from "./CalendarScheduleDetail";
import type { ReactNode, Ref } from "react";
import { Link } from "react-router";

import type { CalendarScheduleModel } from "../model/calendarSchedule";
import { Badge } from "../../../components/badge";
import { Button } from "../../../components/button";
import { ListHeader } from "../../../components/list-header";
import { ListRow } from "../../../components/list-row";
import { PageHeader } from "../../../components/page-header";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { CalendarPlusIcon } from "../../../components/icons/ActionIcons";
import "./CalendarPlanning.css";

interface CalendarPlanningProps {
  headingRef?: Ref<HTMLElement>;
  referenceDate: string;
  schedules: CalendarScheduleModel[];
  focusDate?: string;
  focusDateRevision: number;
  checklistStatus: "loading" | "error" | "complete";
  isGuest: boolean;
  hasTasks: boolean;
  undated: { id: string; title: string; category: string }[];
  retryChecklist: () => void;
  onRequestDate: (id: string) => void;
  recommendations: ReactNode;
  dialogs: ReactNode;
}

export function CalendarPlanning({
  headingRef,
  referenceDate,
  schedules,
  focusDate,
  focusDateRevision,
  checklistStatus,
  isGuest,
  hasTasks,
  undated,
  retryChecklist,
  onRequestDate,
  recommendations,
  dialogs,
}: CalendarPlanningProps) {
  const { selectedDate, selectDate, selectMonth } = useCalendarSelection(
    referenceDate,
    focusDate,
    focusDateRevision,
  );
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(
    null,
  );
  const selectedSchedule = schedules.find(
    (schedule) => schedule.id === selectedScheduleId,
  );
  const schedulesByDate = useMemo(() => {
    const grouped = new Map<string, CalendarScheduleModel[]>();
    for (const schedule of schedules) {
      const items = grouped.get(schedule.date) ?? [];
      items.push(schedule);
      grouped.set(schedule.date, items);
    }
    return grouped;
  }, [schedules]);
  return (
    <section className="calendar-planning" aria-label="내 준비 일정 대시보드">
      <PageHeader
        ref={headingRef}
        tabIndex={-1}
        title="내 준비 일정"
        description="필요한 할 일을 담고, 날짜를 정해 준비 일정을 관리해요."
      />
      <div className="calendar-planning__layout">
        <MonthlyCalendar
          referenceDate={referenceDate}
          selectedDate={selectedDate}
          schedulesByDate={schedulesByDate}
          onSelectDate={selectDate}
          onSelectMonth={selectMonth}
          onSelectSchedule={setSelectedScheduleId}
        />
        <div className="calendar-planning__side">
          <CalendarDaySchedules
            date={selectedDate}
            schedules={schedulesByDate.get(selectedDate) ?? []}
            status={checklistStatus}
            onSelect={setSelectedScheduleId}
            onRetry={retryChecklist}
          />
          <section
            className="calendar-planning__card"
            aria-labelledby="calendar-undated-title"
          >
            <ListHeader
              titleId="calendar-undated-title"
              title={
                <>
                  날짜를 정할 일{" "}
                  {checklistStatus === "complete" && (
                    <Badge color="dark" size="xsmall">
                      {undated.length}개
                    </Badge>
                  )}
                </>
              }
              right={
                isGuest && !hasTasks ? (
                  <Link to="/login?returnTo=%2Fcalendar">
                    로그인하고 일정 관리하기 ›
                  </Link>
                ) : (
                  <Link to="/checklist">내 할 일 전체 보기 ›</Link>
                )
              }
            />
            {isGuest && checklistStatus === "complete" && !hasTasks ? (
              <div className="calendar-planning__empty">
                <p>
                  로그인하면 담은 할 일에 날짜를 정하고
                  <br />내 준비 일정을 저장할 수 있어요.
                </p>
              </div>
            ) : checklistStatus === "loading" ? (
              <ListRow.Loader type="bar" aria-label="내 할 일을 불러오는 중" />
            ) : checklistStatus === "error" ? (
              <div className="calendar-planning__feedback" role="alert">
                <p>내 할 일을 불러오지 못했어요.</p>
                <Button
                  size="small"
                  color="dark"
                  variant="weak"
                  onClick={retryChecklist}
                >
                  다시 시도
                </Button>
              </div>
            ) : undated.length === 0 ? (
              <div className="calendar-planning__empty">
                <p>날짜를 정할 할 일이 없어요.</p>
                {!hasTasks && <p>아래 추천에서 필요한 준비를 담아보세요.</p>}
              </div>
            ) : (
              <ul className="calendar-planning__tasks">
                {undated.slice(0, 3).map((task, index) => (
                  <li key={task.id}>
                    <ListRow
                      border={index === 0 ? "none" : "indented"}
                      contents={
                        <ListRow.Texts
                          top={
                            <span role="heading" aria-level={3}>
                              {task.title}
                            </span>
                          }
                          bottom={
                            <Badge size="xsmall" color="dark">
                              {task.category}
                            </Badge>
                          }
                        />
                      }
                      right={
                        <Button
                          size="small"
                          color="dark"
                          variant="weak"
                          onClick={() => onRequestDate(task.id)}
                        >
                          <CalendarPlusIcon />
                          일정 추가
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            {undated.length > 3 && (
              <Link to="/checklist">
                나머지 {undated.length - 3}개 전체 보기
              </Link>
            )}
          </section>
          {recommendations}
        </div>
      </div>
      {selectedSchedule && (
        <CalendarScheduleDetail
          schedule={selectedSchedule}
          onClose={() => setSelectedScheduleId(null)}
        />
      )}
      {dialogs}
    </section>
  );
}
