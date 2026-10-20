export type ChecklistTaskStatus = "complete" | "in-progress" | "incomplete";

export function calculateChecklistProgress(
  completedTaskCount: number,
  totalTaskCount: number,
): number {
  if (totalTaskCount <= 0) {
    return 0;
  }

  const percentage = Math.round((completedTaskCount / totalTaskCount) * 100);

  return Math.min(100, Math.max(0, percentage));
}
