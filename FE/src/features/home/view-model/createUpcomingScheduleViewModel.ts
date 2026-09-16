import {
  UpcomingScheduleListModel,
  UpcomingScheduleModel,
} from "../model/upcomingSchedule";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface UpcomingScheduleItemViewModel {
  dateTime: string;
  dateLabel: string;
  detailLabel: string;
  id: string;
  relativeDateLabel: string;
  status: "upcoming";
  statusLabel: string;
  title: string;
}

export interface UpcomingScheduleViewModel {
  items: UpcomingScheduleItemViewModel[];
  title: string;
}

function parseDateAsUtc(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

function calculateDaysUntil(referenceDate: string, scheduleDate: string) {
  return Math.round(
    (parseDateAsUtc(scheduleDate) - parseDateAsUtc(referenceDate)) /
      MILLISECONDS_PER_DAY,
  );
}

function formatDate(date: string) {
  const [, month, day] = date.split("-").map(Number);

  return `${month}월 ${day}일`;
}

function formatTime(startTime: string | null) {
  if (startTime === null) {
    return "시간 미정";
  }

  const [hour, minute] = startTime.slice(11, 16).split(":").map(Number);
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;

  return `${period} ${displayHour}:${String(minute).padStart(2, "0")}`;
}

function formatPlace(place: string | null) {
  return place === null || place.trim().length === 0 ? "장소 없음" : place;
}

function formatRelativeDate(daysUntil: number) {
  if (daysUntil === 0) {
    return "오늘";
  }

  if (daysUntil < 0) {
    return `${Math.abs(daysUntil)}일 전`;
  }

  return `${daysUntil}일 뒤`;
}

function createItemViewModel(
  schedule: UpcomingScheduleModel,
  referenceDate: string,
): UpcomingScheduleItemViewModel {
  const daysUntil = calculateDaysUntil(referenceDate, schedule.date);

  return {
    dateTime: schedule.date,
    dateLabel: formatDate(schedule.date),
    detailLabel: `${formatTime(schedule.startTime)} · ${formatPlace(schedule.place)}`,
    id: String(schedule.id),
    relativeDateLabel: formatRelativeDate(daysUntil),
    status: "upcoming",
    statusLabel: "예정",
    title: schedule.title,
  };
}

export function createUpcomingScheduleViewModel(
  model: UpcomingScheduleListModel,
): UpcomingScheduleViewModel {
  return {
    items: model.schedules.map((schedule) =>
      createItemViewModel(schedule, model.referenceDate),
    ),
    title: "가까운 일정",
  };
}
