import {
  PreparationCatalogModel,
  PreparationStepStatus,
} from "../model/preparationRoadmap";

const statusLabels: Record<PreparationStepStatus, string> = {
  complete: "완료",
  "in-progress": "진행 중",
  upcoming: "예정",
};

export interface PreparationCategoryViewModel {
  id: string;
  isCurrent: boolean;
  label: string;
}

export interface PreparationStepViewModel {
  description: string;
  id: string;
  isSelected: boolean;
  numberLabel: string;
  status: PreparationStepStatus;
  statusLabel: string;
  title: string;
}

export interface PreparationRoadmapViewModel {
  categories: PreparationCategoryViewModel[];
  steps: PreparationStepViewModel[];
  title: string;
}

export function createPreparationRoadmapViewModel(
  model: PreparationCatalogModel,
): PreparationRoadmapViewModel {
  return {
    categories: model.categories.map((category) => ({
      id: category.id,
      isCurrent: category.id === model.roadmap.categoryId,
      label: category.label,
    })),
    steps: model.roadmap.steps.map((step) => ({
      description: step.description,
      id: step.id,
      isSelected: step.id === model.roadmap.defaultStepId,
      numberLabel: String(step.order).padStart(2, "0"),
      status: step.status,
      statusLabel: statusLabels[step.status],
      title: step.title,
    })),
    title: model.roadmap.title,
  };
}
