import type { ChecklistItemStatus } from "../../checklist";

export interface AppHeaderSummaryModel {
  completedTaskCount: number;
  totalTaskCount: number;
}

export interface AppHeaderChecklistItem {
  status: ChecklistItemStatus;
}

export function createAppHeaderSummaryModel(
  items: readonly AppHeaderChecklistItem[],
): AppHeaderSummaryModel {
  return {
    completedTaskCount: items.filter((item) => item.status === "done").length,
    totalTaskCount: items.length,
  };
}

export function calculatePreparationProgress(
  completedTaskCount: number,
  totalTaskCount: number,
) {
  if (totalTaskCount <= 0) {
    return 0;
  }

  const progress = Math.round((completedTaskCount / totalTaskCount) * 100);

  return Math.min(100, Math.max(0, progress));
}
