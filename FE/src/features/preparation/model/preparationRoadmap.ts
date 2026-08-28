export type PreparationStepStatus = "complete" | "in-progress" | "upcoming";

export interface PreparationCategoryModel {
  id: string;
  label: string;
}

export interface PreparationStepModel {
  description: string;
  id: string;
  order: number;
  status: PreparationStepStatus;
  title: string;
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
  defaultStepId: string;
  steps: PreparationStepModel[];
  title: string;
}

export interface PreparationCatalogModel {
  categories: PreparationCategoryModel[];
  roadmap: PreparationRoadmapModel;
  stepDetails: PreparationStepDetailModel[];
}
