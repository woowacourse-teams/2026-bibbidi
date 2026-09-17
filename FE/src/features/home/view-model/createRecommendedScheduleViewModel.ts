import type { RecommendedCatalogItemListModel } from "../model/recommendedCatalogItem";
import type { RecommendedTaskAdditionState } from "../model/recommendedTaskAddition";

export interface RecommendedScheduleItemViewModel {
  addActionLabel: string;
  additionErrorMessage?: string;
  categoryLabel: string;
  catalogItemId: number;
  isAddActionDisabled: boolean;
  stepName: string;
  title: string;
}

export interface RecommendedScheduleViewModel {
  catalogActionLabel: string;
  items: RecommendedScheduleItemViewModel[];
  title: string;
}

export function createRecommendedScheduleViewModel(
  model: RecommendedCatalogItemListModel,
  addition: RecommendedTaskAdditionState,
): RecommendedScheduleViewModel {
  return {
    catalogActionLabel: "준비 목록 보기",
    items: model.items.map((item) => {
      const isAdding = addition.addingCatalogItemIds.includes(
        item.catalogItemId,
      );
      const isAdded = addition.addedCatalogItemIds.includes(item.catalogItemId);
      const additionErrorMessage = addition.additionErrors[item.catalogItemId];

      return {
        addActionLabel: isAdding
          ? "추가 중..."
          : isAdded
            ? "추가됨"
            : additionErrorMessage
              ? "다시 시도"
              : "내 할 일에 추가",
        additionErrorMessage,
        categoryLabel: item.category,
        catalogItemId: item.catalogItemId,
        isAddActionDisabled: isAdding || isAdded,
        stepName: item.stepName,
        title: item.title,
      };
    }),
    title: "추천 할 일",
  };
}
