import {
  PreparationCatalogModel,
  PreparationStepProgressModel,
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

export function getInitialSelectedStepId(
  model: PreparationCatalogModel,
  stepProgress: PreparationStepProgressModel[] = [],
): string {
  const statusByStepId = createStatusByStepId(stepProgress);
  const orderedSteps = [...model.roadmap.steps].sort(
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
  selectedStepId: string,
  statusByStepId: Map<string, PreparationStepStatus>,
): PreparationStepDetailViewModel {
  const selectedStep = model.roadmap.steps.find(
    (step) => step.id === selectedStepId,
  );
  const selectedCategory = model.categories.find(
    (category) => category.id === model.roadmap.categoryId,
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
  selectedStepId: string,
  stepProgress: PreparationStepProgressModel[] = [],
): PreparationRoadmapViewModel {
  const statusByStepId = createStatusByStepId(stepProgress);

  return {
    categories: model.categories.map((category) => ({
      id: category.id,
      isCurrent: category.id === model.roadmap.categoryId,
      label: category.label,
    })),
    selectedStepDetail: createSelectedStepDetailViewModel(
      model,
      selectedStepId,
      statusByStepId,
    ),
    steps: model.roadmap.steps.map((step) => {
      const status = getStepStatus(statusByStepId, step.id);

      return {
        description: step.description,
        id: step.id,
        isSelected: step.id === selectedStepId,
        numberLabel: String(step.order).padStart(2, "0"),
        status,
        statusLabel: statusLabels[status],
        title: step.title,
      };
    }),
    title: model.roadmap.title,
  };
}
