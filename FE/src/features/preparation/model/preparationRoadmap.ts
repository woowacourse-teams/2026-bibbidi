export type PreparationStepStatus = "complete" | "in-progress" | "upcoming";

export interface PreparationCategoryModel {
  id: string;
  label: string;
}

export interface PreparationStepModel {
  id: string;
  iconUrl?: string;
  order: number;
  title: string;
}

export interface PreparationStepProgressModel {
  status: PreparationStepStatus;
  stepId: string;
}

export interface PreparationDetailTaskModel {
  essential?: boolean;
  id: string;
  included?: boolean;
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
