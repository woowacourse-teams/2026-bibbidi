import {
  PreparationCatalogModel,
  PreparationRoadmapModel,
  PreparationStepProgressModel,
  PreparationStepStatus,
} from "../model/preparationRoadmap";

const ROADMAP_TITLE = "준비 로드맵";

export interface PreparationCategoryViewModel {
  id: string;
  isCurrent: boolean;
  label: string;
}

export interface PreparationStepViewModel {
  id: string;
  isSelected: boolean;
  numberLabel: string;
  order: number;
  title: string;
}

export interface PreparationRoadmapViewModel {
  categories: PreparationCategoryViewModel[];
  selectedStepDetail: PreparationStepDetailViewModel;
  steps: PreparationStepViewModel[];
  title: string;
}

export interface PreparationStepDetailViewModel {
  description: string;
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
): PreparationStepDetailViewModel {
  const selectedStep = roadmap.steps.find((step) => step.id === selectedStepId);
  const selectedDetail = model.stepDetails.find(
    (detail) => detail.stepId === selectedStepId,
  );

  if (!selectedStep || !selectedDetail) {
    throw new Error("준비 로드맵의 선택 단계 상세 데이터가 올바르지 않습니다.");
  }

  return {
    description: selectedDetail.description,
    tasks: selectedDetail.tasks,
    title: selectedStep.title,
  } satisfies PreparationStepDetailViewModel;
}

export function createPreparationRoadmapViewModel(
  model: PreparationCatalogModel,
  selectedCategoryId: string,
  selectedStepId: string,
): PreparationRoadmapViewModel {
  const roadmap = getRoadmap(model, selectedCategoryId);
  const availableCategories = getAvailableCategories(model);

  return {
    categories: availableCategories.map((category) => ({
      id: category.id,
      isCurrent: category.id === selectedCategoryId,
      label: category.label,
    })),
    selectedStepDetail: createSelectedStepDetailViewModel(
      model,
      roadmap,
      selectedStepId,
    ),
    steps: roadmap.steps.map((step) => ({
      id: step.id,
      isSelected: step.id === selectedStepId,
      numberLabel: String(step.order).padStart(2, "0"),
      order: step.order,
      title: step.title,
    })),
    title: ROADMAP_TITLE,
  };
}
