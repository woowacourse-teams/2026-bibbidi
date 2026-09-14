import {
  AppHeaderSummaryModel,
  AppHeaderWeddingDateModel,
  calculatePreparationProgress,
} from "../model/appHeaderSummary";

export interface AppHeaderProgressViewModel {
  label: string;
  percentage: number;
  taskCountLabel: string;
}

export interface AppHeaderSummaryViewModel {
  dDayLabel: string;
  mobileDDayLabel: string;
  progress: AppHeaderProgressViewModel | null;
  weddingDateLabel: string;
}

function createWeddingDateViewModel(
  weddingDate: AppHeaderWeddingDateModel,
): Pick<
  AppHeaderSummaryViewModel,
  "dDayLabel" | "mobileDDayLabel" | "weddingDateLabel"
> {
  switch (weddingDate.status) {
    case "unset":
      return {
        dDayLabel: "D-Day",
        mobileDDayLabel: "D-Day 미설정",
        weddingDateLabel: "결혼 일자 미설정",
      };
  }
}

export function createAppHeaderSummaryViewModel(
  model: AppHeaderSummaryModel | null,
): AppHeaderSummaryViewModel {
  const weddingDateViewModel = createWeddingDateViewModel(
    model?.weddingDate ?? { status: "unset" },
  );

  if (!model) {
    return {
      progress: null,
      ...weddingDateViewModel,
    };
  }

  const progressPercentage = calculatePreparationProgress(
    model.completedTaskCount,
    model.totalTaskCount,
  );

  return {
    progress: {
      label: `${progressPercentage}%`,
      percentage: progressPercentage,
      taskCountLabel: `${model.completedTaskCount}/${model.totalTaskCount}`,
    },
    ...weddingDateViewModel,
  };
}
