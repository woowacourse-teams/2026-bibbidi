export type ChecklistTaskStatus = "complete" | "in-progress" | "incomplete";

export interface ChecklistTaskModel {
  id: string;
  title: string;
  schedule: string;
  status: ChecklistTaskStatus;
}

export interface ChecklistCategoryModel {
  id: string;
  title: string;
  expanded: boolean;
  tasks: ChecklistTaskModel[];
}

export function calculateChecklistProgress(
  tasks: ChecklistTaskModel[],
): number {
  if (tasks.length === 0) {
    return 0;
  }

  const completedTaskCount = tasks.filter(
    (task) => task.status === "complete",
  ).length;

  return Math.round((completedTaskCount / tasks.length) * 100);
}
