import { useHref, useLinkClickHandler } from "react-router";
import { Button } from "../../../components/button";
import { Dialog } from "../../../components/dialog";

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
  const target = `/checklist?taskId=checklist-item-${schedule.checklistItemId}`;
  const href = useHref(target);
  const navigate = useLinkClickHandler<HTMLAnchorElement>(target);
  const [year, month, day] = schedule.date.split("-").map(Number);
  const startTime = schedule.startTime?.slice(11, 16);
  const endTime = schedule.endTime?.slice(11, 16);

  return (
    <Dialog
      open
      className="calendar-schedule-detail"
      title={<Dialog.Title>{schedule.title}</Dialog.Title>}
      onClose={onClose}
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
          <div>
            <Button
              size="large"
              display="block"
              color="dark"
              variant="weak"
              onClick={onClose}
            >
              닫기
            </Button>
          </div>
          {schedule.checklistItemId && (
            <div>
              <Button.Link
                size="large"
                display="block"
                href={href}
                onClick={navigate}
              >
                상세·수정
              </Button.Link>
            </div>
          )}
        </>
      }
    />
  );
}
