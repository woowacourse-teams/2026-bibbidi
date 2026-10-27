import { useId, useMemo, useState } from "react";
import { useCalendarSelection } from "../useCalendarSelection";
import { useCalendarSticky } from "../useCalendarSticky";
import { CalendarDaySchedules } from "./CalendarDaySchedules";
import { CalendarScheduleDetail } from "./CalendarScheduleDetail";
import type { ReactNode, Ref } from "react";

import type { CalendarScheduleModel } from "../model/calendarSchedule";
import { Button } from "../../../components/button";
import { ListHeader } from "../../../components/list-header";
import { ListFooter } from "../../../components/list-footer";
import { ListRow } from "../../../components/list-row";
import { PageHeader } from "../../../components/page-header";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { CalendarPlusIcon } from "../../../components/icons/ActionIcons";
import { ChevronDown } from "../../../components/icons/Chevron";
import { CalendarSectionLink } from "./CalendarSectionLink";
import "./CalendarList.css";
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
  const { wrapperRef, calendarRef } = useCalendarSticky();
  const undatedListId = useId();
  const [isUndatedExpanded, setUndatedExpanded] = useState(false);
  const remainingUndatedCount = undated.length - 3;
  const undatedFooterLabel = isUndatedExpanded
    ? "접기"
    : `나머지 ${remainingUndatedCount}개 더 보기`;
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
        <div ref={wrapperRef} className="calendar-planning__calendar">
          <MonthlyCalendar
            ref={calendarRef}
            referenceDate={referenceDate}
            selectedDate={selectedDate}
            schedulesByDate={schedulesByDate}
            onSelectDate={selectDate}
            onSelectMonth={selectMonth}
            onSelectSchedule={setSelectedScheduleId}
          />
        </div>
        <div className="calendar-planning__side">
          <CalendarDaySchedules
            date={selectedDate}
            schedules={schedulesByDate.get(selectedDate) ?? []}
            status={checklistStatus}
            onSelect={setSelectedScheduleId}
            onRetry={retryChecklist}
          />
          <section
            className="calendar-list-section"
            aria-labelledby="calendar-undated-title"
          >
            <ListHeader
              titleId="calendar-undated-title"
              title="날짜를 정할 일"
              right={
                isGuest && !hasTasks ? (
                  <CalendarSectionLink to="/login?returnTo=%2Fcalendar">
                    로그인하고 일정 관리하기
                  </CalendarSectionLink>
                ) : (
                  <CalendarSectionLink to="/checklist">
                    내 할 일 전체 보기
                  </CalendarSectionLink>
                )
              }
            />
            {isGuest && checklistStatus === "complete" && !hasTasks ? (
              <div className="calendar-list-empty">
                <p>
                  로그인하면 담은 할 일에 날짜를 정하고
                  <br />내 준비 일정을 저장할 수 있어요.
                </p>
              </div>
            ) : checklistStatus === "loading" ? (
              <ListRow.Loader type="bar" aria-label="내 할 일을 불러오는 중" />
            ) : checklistStatus === "error" ? (
              <div className="calendar-list-feedback" role="alert">
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
              <div className="calendar-list-empty">
                <p>날짜를 정할 할 일이 없어요.</p>
                {!hasTasks && <p>아래 추천에서 필요한 준비를 담아보세요.</p>}
              </div>
            ) : (
              <ul id={undatedListId} className="calendar-list-items">
                {(isUndatedExpanded ? undated : undated.slice(0, 3)).map(
                  (task, index) => (
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
                            bottom={task.category}
                          />
                        }
                        right={
                          <Button
                            size="small"
                            color="primary"
                            variant="fill"
                            onClick={() => onRequestDate(task.id)}
                          >
                            <CalendarPlusIcon size={16} />
                            일정 추가
                          </Button>
                        }
                      />
                    </li>
                  ),
                )}
              </ul>
            )}
            {checklistStatus === "complete" && remainingUndatedCount > 0 && (
              <ListFooter
                border="indented"
                icon={
                  <ChevronDown
                    style={{
                      transform: isUndatedExpanded
                        ? "rotate(180deg)"
                        : undefined,
                    }}
                  />
                }
                aria-label={`날짜를 정할 일 ${undatedFooterLabel}`}
                aria-controls={undatedListId}
                aria-expanded={isUndatedExpanded}
                onClick={() => setUndatedExpanded((expanded) => !expanded)}
              >
                {undatedFooterLabel}
              </ListFooter>
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
