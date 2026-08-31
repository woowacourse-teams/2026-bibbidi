export type PreparationStepStatus = "complete" | "in-progress" | "upcoming";
export type PreparationCategoryNavigationDirection = "next" | "previous";

export interface PreparationCategoryModel {
  id: string;
  label: string;
}

export interface PreparationStepModel {
  description: string;
  id: string;
  order: number;
  title: string;
}

export interface PreparationStepProgressModel {
  status: PreparationStepStatus;
  stepId: string;
}

export interface PreparationDetailTaskModel {
  id: string;
  title: string;
}

export interface PreparationStepDetailModel {
  description: string;
  stepId: string;
  tasks: PreparationDetailTaskModel[];
}

export interface PreparationRoadmapModel {
  categoryId: string;
  steps: PreparationStepModel[];
}

export interface PreparationCatalogModel {
  categories: PreparationCategoryModel[];
  roadmaps: PreparationRoadmapModel[];
  stepDetails: PreparationStepDetailModel[];
}
