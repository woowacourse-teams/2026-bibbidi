import {
  calculateChecklistProgress,
  ChecklistTaskStatus,
} from "../model/checklist";
import {
  ChecklistQueryItemModel,
  ChecklistQueryModel,
} from "../model/checklistQuery";

const statusLabels: Record<ChecklistTaskStatus, string> = {
  complete: "완료",
  "in-progress": "진행 중",
  incomplete: "미완료",
};

export interface ChecklistTaskViewModel {
  appointments: ChecklistAppointmentViewModel[];
  checklistItemId: number | null;
  id: string;
  isEditable: boolean;
  title: string;
  schedule: string;
  status: ChecklistTaskStatus;
  statusLabel: string;
}

export interface ChecklistAppointmentViewModel {
  date: string;
  dateLabel: string;
  dayLabel: string;
  id: number;
  isDone: boolean;
  memoLabel: string;
  monthLabel: string;
  placeLabel: string;
  timeLabel: string;
  title: string;
}

export interface ChecklistCategoryViewModel {
  id: string;
  title: string;
  countLabel: string;
  progress: number;
  progressLabel: string;
  expanded: boolean;
  tasks: ChecklistTaskViewModel[];
}

function getTaskStatus(item: ChecklistQueryItemModel): ChecklistTaskStatus {
  if (item.isDone) {
    return "complete";
  }

  return item.appointments.length > 0 ? "in-progress" : "incomplete";
}

function formatScheduleDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    return date;
  }

  return `${Number(match[2])}월 ${Number(match[3])}일`;
}

function formatAppointmentTime(time: string): string {
  const match = /(?:^|T)(\d{2}):(\d{2})(?::\d{2})?$/.exec(time);

  if (!match) {
    return time;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;

  return minute === 0
    ? `${period} ${displayHour}시`
    : `${period} ${displayHour}시 ${minute}분`;
}

function getAppointmentTimeLabel(
  startTime: string | null,
  endTime: string | null,
): string {
  if (startTime && endTime) {
    return `${formatAppointmentTime(startTime)}–${formatAppointmentTime(endTime)}`;
  }

  if (startTime) {
    return formatAppointmentTime(startTime);
  }

  if (endTime) {
    return `${formatAppointmentTime(endTime)} 종료`;
  }

  return "시간 없음";
}

function createAppointmentViewModel(
  appointment: ChecklistQueryItemModel["appointments"][number],
): ChecklistAppointmentViewModel {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(appointment.date);
  const month = dateMatch ? Number(dateMatch[2]) : undefined;
  const day = dateMatch ? Number(dateMatch[3]) : undefined;

  return {
    date: appointment.date,
    dateLabel: formatScheduleDate(appointment.date),
    dayLabel: day === undefined ? appointment.date : `${day}일`,
    id: appointment.id,
    isDone: appointment.isDone,
    memoLabel: appointment.memo?.trim() || "메모 없음",
    monthLabel: month === undefined ? "날짜" : `${month}월`,
    placeLabel: appointment.place?.trim() || "장소 없음",
    timeLabel: getAppointmentTimeLabel(
      appointment.startTime,
      appointment.endTime,
    ),
    title: appointment.title,
  };
}

function getTaskSchedule(item: ChecklistQueryItemModel): string {
  const earliestDate = item.appointments.reduce<string | undefined>(
    (currentDate, appointment) =>
      currentDate === undefined || appointment.date < currentDate
        ? appointment.date
        : currentDate,
    undefined,
  );

  return earliestDate === undefined
    ? "일정 없음"
    : formatScheduleDate(earliestDate);
}

function createChecklistCategories(checklist: ChecklistQueryModel) {
  return checklist.categories.map((category) => ({
    expanded: category.items.length > 0,
    id: category.id,
    tasks: category.items.map((item) => ({
      appointments: item.appointments.map(createAppointmentViewModel),
      checklistItemId: item.checklistItemId,
      id: item.id,
      isEditable:
        item.checklistItemId !== null && item.sourceCatalogItemId === null,
      schedule: getTaskSchedule(item),
      status: getTaskStatus(item),
      title: item.title,
    })),
    title: category.title,
  }));
}

export function createChecklistViewModel(
  checklist: ChecklistQueryModel,
): ChecklistCategoryViewModel[] {
  const categories = createChecklistCategories(checklist);

  return categories.map((category) => {
    const progress = calculateChecklistProgress(category.tasks);

    return {
      id: category.id,
      title: category.title,
      countLabel: `${category.tasks.length}개`,
      progress,
      progressLabel: `${progress}%`,
      expanded: category.expanded,
      tasks: category.tasks.map((task) => ({
        ...task,
        statusLabel: statusLabels[task.status],
      })),
    };
  });
}
