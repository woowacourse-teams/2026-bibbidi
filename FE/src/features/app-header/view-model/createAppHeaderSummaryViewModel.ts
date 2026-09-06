import {
  AppHeaderSummaryModel,
  calculateDaysUntilWedding,
  calculatePreparationProgress,
} from "../model/appHeaderSummary";

export interface AppHeaderSummaryViewModel {
  dDayLabel: string;
  progressLabel: string;
  progressPercentage: number;
  taskCountLabel: string;
  weddingDate: string;
  weddingDateLabel: string;
}

function formatCompactDate(date: string) {
  return date.replaceAll("-", ".");
}

export function createAppHeaderSummaryViewModel(
  model: AppHeaderSummaryModel,
): AppHeaderSummaryViewModel {
  const daysUntilWedding = calculateDaysUntilWedding(
    model.referenceDate,
    model.weddingDate,
  );
  const progressPercentage = calculatePreparationProgress(
    model.completedTaskCount,
    model.totalTaskCount,
  );

  return {
    dDayLabel: `D-${daysUntilWedding}`,
    progressLabel: `${progressPercentage}%`,
    progressPercentage,
    taskCountLabel: `${model.completedTaskCount}/${model.totalTaskCount}`,
    weddingDate: model.weddingDate,
    weddingDateLabel: formatCompactDate(model.weddingDate),
  };
}
