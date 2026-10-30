import type { RecommendedCatalogItemListModel } from "../model/recommendedCatalogItem";
import type { CatalogTaskAdditionState } from "../../preparation/model/catalogTaskAddition";

const addActionLabels = {
  idle: "내 할 일에 추가",
  adding: "추가 중...",
  added: "추가됨",
  error: "다시 시도",
};

export interface RecommendedScheduleItemViewModel {
  addActionLabel: string;
  addActionStatus: "idle" | "adding" | "added" | "error";
  additionErrorMessage?: string;
  categoryLabel: string;
  catalogItemId: number;
  title: string;
}

export interface RecommendedScheduleViewModel {
  items: RecommendedScheduleItemViewModel[];
  title: string;
}

export function createRecommendedScheduleViewModel(
  model: RecommendedCatalogItemListModel,
  addition: CatalogTaskAdditionState,
): RecommendedScheduleViewModel {
  return {
    items: model.items.map((item) => {
      const isAdding = addition.addingCatalogItemIds.includes(
        item.catalogItemId,
      );
      const isAdded = addition.addedCatalogItemIds.includes(item.catalogItemId);
      const additionErrorMessage = addition.additionErrors[item.catalogItemId];
      const addActionStatus: RecommendedScheduleItemViewModel["addActionStatus"] =
        isAdding
          ? "adding"
          : isAdded
            ? "added"
            : additionErrorMessage
              ? "error"
              : "idle";

      return {
        addActionStatus,
        addActionLabel: addActionLabels[addActionStatus],
        additionErrorMessage,
        categoryLabel: item.category,
        catalogItemId: item.catalogItemId,
        title: item.title,
      };
    }),
    title: "추천 할 일",
  };
}
