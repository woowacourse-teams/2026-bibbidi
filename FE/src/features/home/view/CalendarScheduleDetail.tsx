import { Link } from "react-router";

import { ChecklistModalDialog } from "../../checklist/view/ChecklistModalDialog";
import { CalendarScheduleModel } from "../model/homeScheduleDashboard";
import "./CalendarScheduleDetail.css";

interface CalendarScheduleDetailProps {
  schedule: CalendarScheduleModel;
  onClose: () => void;
}

export function CalendarScheduleDetail({
  schedule,
  onClose,
}: CalendarScheduleDetailProps) {
  const [year, month, day] = schedule.date.split("-").map(Number);
  const startTime = schedule.startTime?.slice(11, 16);
  const endTime = schedule.endTime?.slice(11, 16);

  return (
    <div className="calendar-schedule-detail">
      <ChecklistModalDialog
        title={schedule.title}
        onEscape={onClose}
        onBackdropPress={onClose}
        description={
          <dl>
            <div>
              <dt>날짜</dt>
              <dd>
                {year}년 {month}월 {day}일
              </dd>
            </div>
            <div>
              <dt>시간</dt>
              <dd>
                {startTime
                  ? `${startTime}${endTime ? ` – ${endTime}` : ""}`
                  : "시간 미정"}
              </dd>
            </div>
            {schedule.taskTitle && schedule.taskTitle !== schedule.title && (
              <div>
                <dt>할 일</dt>
                <dd>{schedule.taskTitle}</dd>
              </div>
            )}
            {schedule.place && (
              <div>
                <dt>장소</dt>
                <dd>{schedule.place}</dd>
              </div>
            )}
            {schedule.memo && (
              <div>
                <dt>메모</dt>
                <dd>{schedule.memo}</dd>
              </div>
            )}
          </dl>
        }
        actions={
          <>
            <button type="button" onClick={onClose}>
              닫기
            </button>
            {schedule.checklistItemId && (
              <Link
                to={`/checklist?taskId=checklist-item-${schedule.checklistItemId}`}
              >
                상세·수정
              </Link>
            )}
          </>
        }
      />
    </div>
  );
}
