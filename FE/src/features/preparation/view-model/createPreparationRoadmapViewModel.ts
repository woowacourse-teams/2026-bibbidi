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
  selectedStepDetail: PreparationStepDetailViewModel;
  steps: PreparationStepViewModel[];
  title: string;
}

export interface PreparationStepDetailViewModel {
  categoryLabel: string;
  description: string;
  status: PreparationStepStatus;
  statusLabel: string;
  tasks: {
    id: string;
    title: string;
  }[];
  title: string;
}

function createSelectedStepDetailViewModel(
  model: PreparationCatalogModel,
): PreparationStepDetailViewModel {
  const selectedStep = model.roadmap.steps.find(
    (step) => step.id === model.roadmap.defaultStepId,
  );
  const selectedCategory = model.categories.find(
    (category) => category.id === model.roadmap.categoryId,
  );
  const selectedDetail = model.stepDetails.find(
    (detail) => detail.stepId === model.roadmap.defaultStepId,
  );

  if (!selectedStep || !selectedCategory || !selectedDetail) {
    throw new Error(
      "준비 로드맵의 기본 선택 단계 상세 데이터가 올바르지 않습니다.",
    );
  }

  return {
    categoryLabel: selectedCategory.label,
    description: selectedDetail.description,
    status: selectedStep.status,
    statusLabel: statusLabels[selectedStep.status],
    tasks: selectedDetail.tasks,
    title: selectedStep.title,
  } satisfies PreparationStepDetailViewModel;
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
    selectedStepDetail: createSelectedStepDetailViewModel(model),
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
