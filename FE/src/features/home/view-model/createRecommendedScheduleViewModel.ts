import { RecommendedCatalogItemListModel } from "../model/recommendedCatalogItem";

export interface RecommendedScheduleItemViewModel {
  categoryLabel: string;
  catalogItemId: number;
  stepName: string;
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
  model: RecommendedCatalogItemListModel,
): RecommendedScheduleViewModel {
  return {
    addTaskLabel: "내 할 일에 추가",
    catalogActionLabel: "준비 목록 보기",
    isAddTaskActionDisabled: true,
    isCatalogActionDisabled: true,
    items: model.items.map((item) => ({
      categoryLabel: item.category,
      catalogItemId: item.catalogItemId,
      stepName: item.stepName,
      title: item.title,
    })),
    title: "추천 할 일",
  };
}
