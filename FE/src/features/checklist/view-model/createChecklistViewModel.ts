import {
  calculateChecklistProgress,
  ChecklistCategoryModel,
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
  id: string;
  title: string;
  schedule: string;
  status: ChecklistTaskStatus;
  statusLabel: string;
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

function createChecklistCategories(
  checklist: ChecklistQueryModel,
): ChecklistCategoryModel[] {
  return checklist.categories.map((category) => ({
    expanded: category.items.length > 0,
    id: category.id,
    tasks: category.items.map((item) => ({
      id: item.id,
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
