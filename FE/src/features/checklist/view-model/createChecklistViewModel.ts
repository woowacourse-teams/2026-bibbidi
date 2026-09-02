import {
  calculateChecklistProgress,
  ChecklistCategoryModel,
  ChecklistTaskStatus,
} from "../model/checklist";

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

export function createChecklistViewModel(
  categories: ChecklistCategoryModel[],
): ChecklistCategoryViewModel[] {
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
