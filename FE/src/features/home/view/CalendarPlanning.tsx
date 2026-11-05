import type { ReactNode } from "react";
import { Link } from "react-router";

import type { CalendarScheduleModel } from "../model/homeScheduleDashboard";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { CalendarPlusIcon } from "./UnscheduledTask";
import "./CalendarPlanning.css";

interface CalendarPlanningProps {
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
  return (
    <section className="calendar-planning" aria-label="내 준비 일정 대시보드">
      <header className="calendar-planning__heading">
        <h1>내 준비 일정</h1>
        <p>필요한 할 일을 담고, 날짜를 정해 준비 일정을 관리해요.</p>
      </header>
      <div className="calendar-planning__layout">
        <div className="calendar-planning__main">
          <MonthlyCalendar
            monthTitleOnly
            referenceDate={referenceDate}
            schedules={schedules}
            focusDate={focusDate}
            focusDateRevision={focusDateRevision}
            schedulesStatus={checklistStatus}
          />
          {checklistStatus === "loading" && (
            <p className="calendar-planning__loading" role="status">
              내 할 일과 일정을 불러오고 있어요.
            </p>
          )}
          {checklistStatus === "error" && (
            <div className="calendar-planning__feedback" role="alert">
              내 할 일과 일정을 불러오지 못했어요.{" "}
              <button onClick={retryChecklist} type="button">
                다시 시도
              </button>
            </div>
          )}
        </div>
        <div className="calendar-planning__side">
          <section
            className="calendar-planning__card"
            aria-labelledby="calendar-undated-title"
          >
            <header>
              <h2 id="calendar-undated-title">
                날짜를 정할 일{" "}
                {checklistStatus === "complete" && (
                  <span>{undated.length}개</span>
                )}
              </h2>
              {isGuest && !hasTasks ? (
                <Link to="/login?returnTo=%2Fcalendar">
                  로그인하고 일정 관리하기 ›
                </Link>
              ) : (
                <Link to="/checklist">내 할 일 전체 보기 ›</Link>
              )}
            </header>
            {isGuest && checklistStatus === "complete" && !hasTasks ? (
              <div className="calendar-planning__empty">
                <p>
                  로그인하면 담은 할 일에 날짜를 정하고
                  <br />내 준비 일정을 저장할 수 있어요.
                </p>
              </div>
            ) : checklistStatus === "loading" ? (
              <div className="calendar-planning__skeleton" aria-busy="true">
                <p role="status">내 할 일을 불러오는 중</p>
              </div>
            ) : checklistStatus === "error" ? (
              <p>
                내 할 일을 불러오지 못했어요.{" "}
                <button onClick={retryChecklist} type="button">
                  다시 시도
                </button>
              </p>
            ) : undated.length === 0 ? (
              <div className="calendar-planning__empty">
                <p>날짜를 정할 할 일이 없어요.</p>
                {!hasTasks && <p>아래 추천에서 필요한 준비를 담아보세요.</p>}
              </div>
            ) : (
              <ul className="calendar-planning__tasks">
                {undated.slice(0, 3).map((task) => (
                  <li key={task.id}>
                    <div>
                      <small>{task.category}</small>
                      <h3>{task.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRequestDate(task.id)}
                    >
                      <CalendarPlusIcon />
                      일정 추가
                    </button>
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
      {dialogs}
    </section>
  );
}
