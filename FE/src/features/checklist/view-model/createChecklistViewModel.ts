import {
  calculateChecklistProgress,
  ChecklistTaskStatus,
} from "../model/checklist";
import {
  ChecklistQueryItemModel,
  ChecklistQueryModel,
} from "../model/checklistQuery";
import { ChecklistItemStatus } from "../model/myChecklist";

const statusLabels: Record<ChecklistTaskStatus, string> = {
  complete: "완료",
  "in-progress": "진행 중",
  incomplete: "예정",
};

const taskStatusByChecklistItemStatus: Record<
  ChecklistItemStatus,
  ChecklistTaskStatus
> = {
  continue: "in-progress",
  done: "complete",
  prev: "incomplete",
};

export interface ChecklistTaskViewModel {
  appointments: ChecklistAppointmentViewModel[];
  categoryId: string;
  checklistItemStatus: ChecklistItemStatus;
  checklistItemId: number | null;
  id: string;
  isEditable: boolean;
  isStatusEditable: boolean;
  title: string;
  schedule: string;
  status: ChecklistTaskStatus;
  statusLabel: string;
}

export interface ChecklistAppointmentViewModel {
  date: string;
  dateLabel: string;
  dayLabel: string;
  endTime: string | null;
  id: number;
  isDone: boolean;
  memo: string | null;
  memoLabel: string;
  monthLabel: string;
  place: string | null;
  placeLabel: string;
  startTime: string | null;
  timeLabel: string;
  title: string;
}

export interface ChecklistCategoryViewModel {
  completedCount: number;
  groups: ChecklistGroupViewModel[];
  id: string;
  title: string;
  countLabel: string;
  progress: number;
  progressLabel: string;
  tasks: ChecklistTaskViewModel[];
  totalCount: number;
}

export interface ChecklistGroupViewModel {
  completedCount: number;
  countLabel: string;
  expanded: boolean;
  id: string;
  isCustom: boolean;
  numberLabel: string;
  progress: number;
  progressLabel: string;
  tasks: ChecklistTaskViewModel[];
  title: string;
  totalCount: number;
}

function getTaskStatus(item: ChecklistQueryItemModel): ChecklistTaskStatus {
  return taskStatusByChecklistItemStatus[item.status];
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
    endTime: appointment.endTime,
    id: appointment.id,
    isDone: appointment.isDone,
    memo: appointment.memo,
    memoLabel: appointment.memo?.trim() || "메모 없음",
    monthLabel: month === undefined ? "날짜" : `${month}월`,
    place: appointment.place,
    placeLabel: appointment.place?.trim() || "장소 없음",
    startTime: appointment.startTime,
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

function createTask(item: ChecklistQueryItemModel): ChecklistTaskViewModel {
  const status = getTaskStatus(item);

  return {
    appointments: item.appointments.map(createAppointmentViewModel),
    categoryId: item.categoryId,
    checklistItemStatus: item.status,
    checklistItemId: item.checklistItemId,
    id: item.id,
    isEditable:
      item.checklistItemId !== null && item.sourceCatalogItemId === null,
    isStatusEditable: item.checklistItemId !== null,
    schedule: getTaskSchedule(item),
    status,
    statusLabel: statusLabels[status],
    title: item.title,
  };
}

function createGroup(
  id: string,
  title: string,
  numberLabel: string,
  items: ChecklistQueryItemModel[],
  isCustom: boolean,
): Omit<ChecklistGroupViewModel, "expanded"> {
  const tasks = items.map(createTask);
  const completedCount = tasks.filter(
    (task) => task.status === "complete",
  ).length;
  const progress = calculateChecklistProgress(tasks);

  return {
    completedCount,
    countLabel: `${completedCount}/${tasks.length}`,
    id,
    isCustom,
    numberLabel,
    progress,
    progressLabel: `${progress}%`,
    tasks,
    title,
    totalCount: tasks.length,
  };
}

export function createChecklistViewModel(
  checklist: ChecklistQueryModel,
): ChecklistCategoryViewModel[] {
  return checklist.categories.map((category) => {
    const steps = category.steps
      ? category.steps
      : category.items.length > 0
        ? [
            {
              id: `${category.id}-legacy`,
              items: category.items,
              order: 1,
              title: category.title,
            },
          ]
        : [];
    const groups = steps
      .filter((step) => step.items.length > 0)
      .map((step) =>
        createGroup(
          step.id,
          step.title,
          String(step.order).padStart(2, "0"),
          step.items,
          false,
        ),
      );

    const customItems = category.customItems;

    if (customItems && customItems.length > 0) {
      groups.push(
        createGroup(
          `${category.id}-custom`,
          "내가 추가한 일",
          "+",
          customItems,
          true,
        ),
      );
    }

    const defaultExpandedGroup =
      groups.find((group) => group.completedCount < group.totalCount) ??
      groups[0];
    const groupsWithExpansion = groups.map((group) => ({
      ...group,
      expanded: group.id === defaultExpandedGroup?.id,
    }));
    const tasks = groupsWithExpansion.flatMap((group) => group.tasks);
    const completedCount = tasks.filter(
      (task) => task.status === "complete",
    ).length;
    const progress = calculateChecklistProgress(tasks);

    return {
      completedCount,
      id: category.id,
      title: category.title,
      countLabel: `${completedCount}/${tasks.length}`,
      groups: groupsWithExpansion,
      progress,
      progressLabel: `${progress}%`,
      tasks,
      totalCount: tasks.length,
    };
  });
}
