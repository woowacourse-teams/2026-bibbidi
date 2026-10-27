import { useHref, useLinkClickHandler } from "react-router";
import { Button } from "../../../components/button";
import { Dialog } from "../../../components/dialog";
import { ListRow } from "../../../components/list-row";

import type { CalendarScheduleModel } from "../model/calendarSchedule";
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
  const properties = [
    {
      term: "날짜",
      description: (
        <time dateTime={schedule.date}>
          {year}년 {month}월 {day}일
        </time>
      ),
    },
    {
      term: "시간",
      description: startTime
        ? `${startTime}${endTime ? ` – ${endTime}` : ""}`
        : "시간 미정",
    },
    {
      term: "할 일",
      description:
        schedule.taskTitle !== schedule.title ? schedule.taskTitle : null,
    },
    { term: "장소", description: schedule.place },
    { term: "메모", description: schedule.memo },
  ].filter((property) => property.description);

  return (
    <Dialog
      open
      className="calendar-schedule-detail"
      title={<Dialog.Title>{schedule.title}</Dialog.Title>}
      onClose={onClose}
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
    >
      <dl className="calendar-schedule-detail__properties">
        {properties.map((property, index) => (
          <ListRow.Description
            key={property.term}
            className="calendar-schedule-detail__property"
            horizontalPadding="none"
            border={index === 0 ? "none" : "indented"}
            term={
              <span className="calendar-schedule-detail__term">
                {property.term}
              </span>
            }
            description={
              <span className="calendar-schedule-detail__value">
                {property.description}
              </span>
            }
          />
        ))}
      </dl>
    </Dialog>
  );
}
