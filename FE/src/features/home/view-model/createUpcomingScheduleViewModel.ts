import {
  UpcomingScheduleListModel,
  UpcomingScheduleModel,
  UpcomingScheduleStatus,
} from "../model/upcomingSchedule";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const statusLabels: Record<UpcomingScheduleStatus, string> = {
  "in-progress": "진행 중",
  upcoming: "예정",
};

export interface UpcomingScheduleItemViewModel {
  dateTime: string;
  dateLabel: string;
  detailLabel: string;
  id: string;
  relativeDateLabel: string;
  status: UpcomingScheduleStatus;
  statusLabel: string;
  title: string;
}

export interface UpcomingScheduleViewModel {
  countLabel: string;
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

function formatTime(time: string | null) {
  if (time === null) {
    return "시간 미정";
  }

  const [hour, minute] = time.split(":").map(Number);
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;

  return `${period} ${displayHour}:${String(minute).padStart(2, "0")}`;
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
    detailLabel: `${formatTime(schedule.time)} · ${schedule.location}`,
    id: schedule.id,
    relativeDateLabel: formatRelativeDate(daysUntil),
    status: schedule.status,
    statusLabel: statusLabels[schedule.status],
    title: schedule.title,
  };
}

export function createUpcomingScheduleViewModel(
  model: UpcomingScheduleListModel,
): UpcomingScheduleViewModel {
  const schedulesByDate = [...model.schedules].sort(
    (left, right) => parseDateAsUtc(left.date) - parseDateAsUtc(right.date),
  );

  return {
    countLabel: `${schedulesByDate.length}개`,
    items: schedulesByDate.map((schedule) =>
      createItemViewModel(schedule, model.referenceDate),
    ),
    title: "가까운 일정",
  };
}
