import {
  UnscheduledTaskListModel,
  UnscheduledTaskStatus,
} from "../model/unscheduledTask";

const statusLabels: Record<UnscheduledTaskStatus, string> = {
  continue: "진행 중",
  prev: "미완료",
};

export interface UnscheduledTaskItemViewModel {
  categoryLabel: string;
  id: number;
  statusLabel: string;
  title: string;
}

export interface UnscheduledTaskViewModel {
  addScheduleLabel: string;
  items: UnscheduledTaskItemViewModel[];
  title: string;
}

export function createUnscheduledTaskViewModel(
  model: UnscheduledTaskListModel,
): UnscheduledTaskViewModel {
  return {
    addScheduleLabel: "일정 추가",
    items: model.tasks.map((task) => ({
      categoryLabel: task.category,
      id: task.id,
      statusLabel: statusLabels[task.status],
      title: task.title,
    })),
    title: "일정이 필요한 할 일",
  };
}
