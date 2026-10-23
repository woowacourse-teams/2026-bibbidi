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
  taskCountLabel: string;
}

export interface AppHeaderCategoryProgressViewModel {
  id: string;
  title: string;
  progress: number;
  taskCountLabel: string;
}

export interface AppHeaderSummaryViewModel {
  isWeddingDateUnset: boolean;
  weddingDateDescription: string;
  weddingDateActionLabel: string | null;
  weddingDateAccessibleLabel: string;
  progress: AppHeaderProgressViewModel | null;
  weddingDateLabel: string;
  weddingDateStatus: WeddingDateLoadState["status"];
}

function taskCountLabel(completed: number, total: number) {
  return `${completed}/${total}개 완료`;
}

function createWeddingDateViewModel(
  weddingDate: WeddingDateLoadState,
  today: Date,
) {
  if (weddingDate.status === "loading") {
    return {
      dDayLabel: "D-Day",
      weddingDateLabel: "결혼 예정일 조회 중",
    };
  }
  if (weddingDate.status === "error") {
    return {
      dDayLabel: "D-Day",
      weddingDateLabel: "결혼 예정일 조회 실패",
    };
  }
  if (weddingDate.date === null) {
    return {
      dDayLabel: "D-Day",
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

  const isWeddingDateUnset =
    weddingDate.status === "loaded" && weddingDate.date === null;
  const weddingDateDescription = isWeddingDateUnset
    ? "날짜를 설정하면 D-day를 확인할 수 있어요."
    : `${weddingDateViewModel.dDayLabel} · ${weddingDateViewModel.weddingDateLabel}`;
  const weddingDateActionLabel = isWeddingDateUnset ? "설정하기" : null;

  return {
    isWeddingDateUnset,
    weddingDateDescription,
    weddingDateActionLabel,
    weddingDateAccessibleLabel: isWeddingDateUnset
      ? `결혼 예정일 ${weddingDateActionLabel}. ${weddingDateDescription}`
      : `${weddingDateViewModel.dDayLabel}, ${weddingDateViewModel.weddingDateLabel}. 결혼 예정일 설정`,
    progress:
      model && progressPercentage !== null
        ? {
            categories: model.categories.map((category) => ({
              id: category.id,
              title: category.title,
              progress:
                calculateChecklistProgress(
                  category.completedTaskCount,
                  category.totalTaskCount,
                ) / 100,
              taskCountLabel: taskCountLabel(
                category.completedTaskCount,
                category.totalTaskCount,
              ),
            })),
            label: `${progressPercentage}%`,
            percentage: progressPercentage,
            taskCountLabel: taskCountLabel(
              model.completedTaskCount,
              model.totalTaskCount,
            ),
          }
        : null,
    weddingDateStatus: weddingDate.status,
    weddingDateLabel: weddingDateViewModel.weddingDateLabel,
  };
}
