import {
  PreparationCategoryNavigationDirection,
  PreparationCatalogModel,
  PreparationRoadmapModel,
  PreparationStepProgressModel,
  PreparationStepStatus,
} from "../model/preparationRoadmap";

const statusLabels: Record<PreparationStepStatus, string> = {
  complete: "완료",
  "in-progress": "진행 중",
  upcoming: "예정",
};
const ROADMAP_TITLE = "준비 로드맵";

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
  order: number;
  status: PreparationStepStatus;
  statusLabel: string;
  title: string;
}

export interface PreparationRoadmapViewModel {
  categoryNavigation: {
    canNavigateNext: boolean;
    canNavigatePrevious: boolean;
  };
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

export interface PreparationRoadmapSelection {
  categoryId: string;
  stepId: string;
}

function getRoadmap(
  model: PreparationCatalogModel,
  categoryId: string,
): PreparationRoadmapModel {
  const roadmap = model.roadmaps.find(
    (candidate) => candidate.categoryId === categoryId,
  );

  if (!roadmap) {
    throw new Error("선택한 준비 카테고리의 로드맵이 없습니다.");
  }

  return roadmap;
}

function getAvailableCategories(model: PreparationCatalogModel) {
  return model.categories.filter((category) =>
    model.roadmaps.some((roadmap) => roadmap.categoryId === category.id),
  );
}

export function getInitialSelectedCategoryId(
  model: PreparationCatalogModel,
): string {
  const initialCategory = getAvailableCategories(model)[0];

  if (!initialCategory) {
    throw new Error("선택할 준비 카테고리가 없습니다.");
  }

  return initialCategory.id;
}

export function getInitialSelectedStepId(
  model: PreparationCatalogModel,
  categoryId: string,
  stepProgress: PreparationStepProgressModel[] = [],
): string {
  const roadmap = getRoadmap(model, categoryId);
  const statusByStepId = createStatusByStepId(stepProgress);
  const orderedSteps = [...roadmap.steps].sort(
    (firstStep, secondStep) => firstStep.order - secondStep.order,
  );
  const firstStep = orderedSteps[0];

  if (!firstStep) {
    throw new Error("준비 로드맵에 선택할 단계가 없습니다.");
  }

  if (
    orderedSteps.every(
      (step) => getStepStatus(statusByStepId, step.id) === "complete",
    )
  ) {
    return orderedSteps[orderedSteps.length - 1].id;
  }

  return (
    orderedSteps.find(
      (step) => getStepStatus(statusByStepId, step.id) === "in-progress",
    )?.id ?? firstStep.id
  );
}

export function createInitialPreparationRoadmapSelection(
  model: PreparationCatalogModel,
  stepProgress: PreparationStepProgressModel[] = [],
): PreparationRoadmapSelection {
  const categoryId = getInitialSelectedCategoryId(model);

  return {
    categoryId,
    stepId: getInitialSelectedStepId(model, categoryId, stepProgress),
  };
}

export function selectPreparationCategory(
  model: PreparationCatalogModel,
  currentSelection: PreparationRoadmapSelection,
  categoryId: string,
  stepProgress: PreparationStepProgressModel[] = [],
): PreparationRoadmapSelection {
  if (currentSelection.categoryId === categoryId) {
    return currentSelection;
  }

  return {
    categoryId,
    stepId: getInitialSelectedStepId(model, categoryId, stepProgress),
  };
}

export function selectAdjacentPreparationCategory(
  model: PreparationCatalogModel,
  currentSelection: PreparationRoadmapSelection,
  direction: PreparationCategoryNavigationDirection,
  stepProgress: PreparationStepProgressModel[] = [],
): PreparationRoadmapSelection {
  const availableCategoryIds = getAvailableCategories(model).map(
    (category) => category.id,
  );
  const currentCategoryIndex = availableCategoryIds.indexOf(
    currentSelection.categoryId,
  );

  if (currentCategoryIndex < 0) {
    throw new Error("현재 선택된 준비 카테고리가 올바르지 않습니다.");
  }

  const indexOffset = direction === "next" ? 1 : -1;
  const targetCategoryId =
    availableCategoryIds[currentCategoryIndex + indexOffset];

  if (!targetCategoryId) {
    return currentSelection;
  }

  return selectPreparationCategory(
    model,
    currentSelection,
    targetCategoryId,
    stepProgress,
  );
}

function createStatusByStepId(stepProgress: PreparationStepProgressModel[]) {
  return new Map(
    stepProgress.map((progress) => [progress.stepId, progress.status]),
  );
}

function getStepStatus(
  statusByStepId: Map<string, PreparationStepStatus>,
  stepId: string,
): PreparationStepStatus {
  return statusByStepId.get(stepId) ?? "upcoming";
}

function createSelectedStepDetailViewModel(
  model: PreparationCatalogModel,
  roadmap: PreparationRoadmapModel,
  selectedStepId: string,
  statusByStepId: Map<string, PreparationStepStatus>,
): PreparationStepDetailViewModel {
  const selectedStep = roadmap.steps.find((step) => step.id === selectedStepId);
  const selectedCategory = model.categories.find(
    (category) => category.id === roadmap.categoryId,
  );
  const selectedDetail = model.stepDetails.find(
    (detail) => detail.stepId === selectedStepId,
  );

  if (!selectedStep || !selectedCategory || !selectedDetail) {
    throw new Error("준비 로드맵의 선택 단계 상세 데이터가 올바르지 않습니다.");
  }

  const status = getStepStatus(statusByStepId, selectedStep.id);

  return {
    categoryLabel: selectedCategory.label,
    description: selectedDetail.description,
    status,
    statusLabel: statusLabels[status],
    tasks: selectedDetail.tasks,
    title: selectedStep.title,
  } satisfies PreparationStepDetailViewModel;
}

export function createPreparationRoadmapViewModel(
  model: PreparationCatalogModel,
  selectedCategoryId: string,
  selectedStepId: string,
  stepProgress: PreparationStepProgressModel[] = [],
): PreparationRoadmapViewModel {
  const roadmap = getRoadmap(model, selectedCategoryId);
  const statusByStepId = createStatusByStepId(stepProgress);
  const availableCategories = getAvailableCategories(model);
  const selectedCategoryIndex = availableCategories.findIndex(
    (category) => category.id === selectedCategoryId,
  );

  return {
    categoryNavigation: {
      canNavigateNext:
        selectedCategoryIndex >= 0 &&
        selectedCategoryIndex < availableCategories.length - 1,
      canNavigatePrevious: selectedCategoryIndex > 0,
    },
    categories: availableCategories.map((category) => ({
      id: category.id,
      isCurrent: category.id === selectedCategoryId,
      label: category.label,
    })),
    selectedStepDetail: createSelectedStepDetailViewModel(
      model,
      roadmap,
      selectedStepId,
      statusByStepId,
    ),
    steps: roadmap.steps.map((step) => {
      const status = getStepStatus(statusByStepId, step.id);

      return {
        description: step.description,
        id: step.id,
        isSelected: step.id === selectedStepId,
        numberLabel: String(step.order).padStart(2, "0"),
        order: step.order,
        status,
        statusLabel: statusLabels[status],
        title: step.title,
      };
    }),
    title: ROADMAP_TITLE,
  };
}
