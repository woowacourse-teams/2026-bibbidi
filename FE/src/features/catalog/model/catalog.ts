export interface CatalogCategoryModel {
  id: string;
  label: string;
}

export interface CatalogStepModel {
  id: string;
  iconUrl?: string;
  order: number;
  title: string;
}

export interface CatalogItemModel {
  essential?: boolean;
  id: string;
  title: string;
}

export interface CatalogStepDetailModel {
  description: string;
  stepId: string;
  tasks: CatalogItemModel[];
}

export interface CatalogRoadmapModel {
  categoryId: string;
  steps: CatalogStepModel[];
}

export interface CatalogModel {
  categories: CatalogCategoryModel[];
  roadmaps: CatalogRoadmapModel[];
  stepDetails: CatalogStepDetailModel[];
}
