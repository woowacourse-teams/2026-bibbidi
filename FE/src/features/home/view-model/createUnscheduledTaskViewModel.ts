import {
  UnscheduledTaskListModel,
  UnscheduledTaskStatus,
} from "../model/unscheduledTask";

const statusLabels: Record<UnscheduledTaskStatus, string> = {
  "in-progress": "진행 중",
};

export interface UnscheduledTaskItemViewModel {
  categoryLabel: string;
  id: string;
  statusLabel: string;
  title: string;
}

export interface UnscheduledTaskViewModel {
  addScheduleLabel: string;
  countLabel: string;
  items: UnscheduledTaskItemViewModel[];
  title: string;
}

export function createUnscheduledTaskViewModel(
  model: UnscheduledTaskListModel,
): UnscheduledTaskViewModel {
  return {
    addScheduleLabel: "일정 추가",
    countLabel: `${model.tasks.length}개`,
    items: model.tasks.map((task) => ({
      categoryLabel: task.category,
      id: task.id,
      statusLabel: statusLabels[task.status],
      title: task.title,
    })),
    title: "일정이 필요한 할 일",
  };
}
