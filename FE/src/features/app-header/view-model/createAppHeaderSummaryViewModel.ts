import { calculateChecklistProgress } from "../../checklist";
import { AppHeaderSummaryModel } from "../model/appHeaderSummary";
import {
  calculateDaysUntilWedding,
  WeddingDateLoadState,
} from "../model/weddingDate";

export interface AppHeaderProgressViewModel {
  categories: AppHeaderCategoryProgressViewModel[];
  label: string;
  percentage: number;
  summaryLabel: string;
  taskCountLabel: string;
}

export interface AppHeaderCategoryProgressViewModel {
  id: string;
  title: string;
  percentage: number;
  taskCountLabel: string;
}

export interface AppHeaderSummaryViewModel {
  dDayLabel: string;
  mobileDDayLabel: string;
  progress: AppHeaderProgressViewModel | null;
  weddingDateLabel: string;
  weddingDateStatus: WeddingDateLoadState["status"];
}

function createWeddingDateViewModel(
  weddingDate: WeddingDateLoadState,
  today: Date,
) {
  if (weddingDate.status === "loading") {
    return {
      dDayLabel: "D-Day",
      mobileDDayLabel: "결혼 예정일 조회 중",
      weddingDateLabel: "결혼 예정일 조회 중",
    };
  }
  if (weddingDate.status === "error") {
    return {
      dDayLabel: "D-Day",
      mobileDDayLabel: "결혼 예정일 조회 실패",
      weddingDateLabel: "결혼 예정일 조회 실패",
    };
  }
  if (weddingDate.date === null) {
    return {
      dDayLabel: "D-Day",
      mobileDDayLabel: "D-Day 미설정",
      weddingDateLabel: "결혼 일자 미설정",
    };
  }

  const [year, month, day] = weddingDate.date.split("-").map(Number);
  const daysUntil = calculateDaysUntilWedding(weddingDate.date, today);
  const dDayLabel =
    daysUntil === 0
      ? "D-Day"
      : daysUntil > 0
        ? `D-${daysUntil}`
        : `D+${Math.abs(daysUntil)}`;

  return {
    dDayLabel,
    mobileDDayLabel: dDayLabel,
    weddingDateLabel: `${year}년 ${month}월 ${day}일`,
  };
}

export function createAppHeaderSummaryViewModel(
  model: AppHeaderSummaryModel | null,
  weddingDate: WeddingDateLoadState,
  today: Date = new Date(),
): AppHeaderSummaryViewModel {
  const weddingDateViewModel = createWeddingDateViewModel(weddingDate, today);
  const progressPercentage = model
    ? calculateChecklistProgress(model.completedTaskCount, model.totalTaskCount)
    : null;

  return {
    progress:
      model && progressPercentage !== null
        ? {
            categories: model.categories.map((category) => ({
              id: category.id,
              title: category.title,
              percentage: calculateChecklistProgress(
                category.completedTaskCount,
                category.totalTaskCount,
              ),
              taskCountLabel: `${category.completedTaskCount}/${category.totalTaskCount}`,
            })),
            label: `${progressPercentage}%`,
            percentage: progressPercentage,
            summaryLabel: `전체 ${model.completedTaskCount}/${model.totalTaskCount}개 완료 · ${progressPercentage}%`,
            taskCountLabel: `${model.completedTaskCount}/${model.totalTaskCount}`,
          }
        : null,
    weddingDateStatus: weddingDate.status,
    ...weddingDateViewModel,
  };
}
