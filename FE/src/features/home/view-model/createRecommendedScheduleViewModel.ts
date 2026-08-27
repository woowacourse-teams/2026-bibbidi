import { RecommendedScheduleListModel } from "../model/recommendedSchedule";

export interface RecommendedScheduleItemViewModel {
  categoryLabel: string;
  id: string;
  reason: string;
  recommendedTimingLabel: string;
  title: string;
}

export interface RecommendedScheduleViewModel {
  addTaskLabel: string;
  catalogActionLabel: string;
  isAddTaskActionDisabled: boolean;
  isCatalogActionDisabled: boolean;
  items: RecommendedScheduleItemViewModel[];
  title: string;
}

export function createRecommendedScheduleViewModel(
  model: RecommendedScheduleListModel,
): RecommendedScheduleViewModel {
  return {
    addTaskLabel: "내 할 일에 추가",
    catalogActionLabel: "준비 목록 보기",
    isAddTaskActionDisabled: true,
    isCatalogActionDisabled: true,
    items: model.schedules.map((schedule) => ({
      categoryLabel: schedule.category,
      id: schedule.id,
      reason: schedule.reason,
      recommendedTimingLabel: `${schedule.recommendedMonthsBefore}개월 전`,
      title: schedule.title,
    })),
    title: "추가하면 좋은 일정",
  };
}
