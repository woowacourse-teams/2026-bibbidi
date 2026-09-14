export interface AppHeaderWeddingDateModel {
  status: "unset";
}

export interface AppHeaderSummaryModel {
  completedTaskCount: number;
  totalTaskCount: number;
  weddingDate: AppHeaderWeddingDateModel;
}

export interface AppHeaderChecklistItem {
  isDone: boolean;
}

export function createAppHeaderSummaryModel(
  items: readonly AppHeaderChecklistItem[],
): AppHeaderSummaryModel {
  return {
    completedTaskCount: items.filter((item) => item.isDone).length,
    totalTaskCount: items.length,
    weddingDate: { status: "unset" },
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
