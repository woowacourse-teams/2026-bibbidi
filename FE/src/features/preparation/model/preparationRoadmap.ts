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

export interface PreparationRoadmapModel {
  categoryId: string;
  defaultStepId: string;
  steps: PreparationStepModel[];
  title: string;
}

export interface PreparationCatalogModel {
  categories: PreparationCategoryModel[];
  roadmap: PreparationRoadmapModel;
}
