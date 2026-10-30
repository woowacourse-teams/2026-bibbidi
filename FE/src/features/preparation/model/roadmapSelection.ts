import type { PreparationCatalogModel } from "./preparationRoadmap";

export interface PreparationRoadmapSelection {
  categoryId: string;
  stepId: string;
}
export function getAvailablePreparationCategories(
  model: PreparationCatalogModel,
) {
  return model.categories.filter((category) =>
    model.roadmaps.some(
      (roadmap) =>
        roadmap.categoryId === category.id && roadmap.steps.length > 0,
    ),
  );
}
export function hasSelectablePreparationSteps(model: PreparationCatalogModel) {
  return getAvailablePreparationCategories(model).length > 0;
}
export function getInitialSelectedCategoryId(
  model: PreparationCatalogModel,
): string {
  const category = getAvailablePreparationCategories(model)[0];
  if (!category) throw new Error("선택할 준비 카테고리가 없습니다.");
  return category.id;
}
export function getInitialSelectedStepId(
  model: PreparationCatalogModel,
  categoryId: string,
): string {
  const steps =
    model.roadmaps.find((roadmap) => roadmap.categoryId === categoryId)
      ?.steps ?? [];
  const first = [...steps].sort((a, b) => a.order - b.order)[0];
  if (!first) throw new Error("준비 로드맵에 선택할 단계가 없습니다.");
  return first.id;
}
export function createInitialPreparationRoadmapSelection(
  model: PreparationCatalogModel,
): PreparationRoadmapSelection {
  const categoryId = getInitialSelectedCategoryId(model);
  return { categoryId, stepId: getInitialSelectedStepId(model, categoryId) };
}
export function selectPreparationCategory(
  model: PreparationCatalogModel,
  selection: PreparationRoadmapSelection,
  categoryId: string,
): PreparationRoadmapSelection {
  return selection.categoryId === categoryId
    ? selection
    : { categoryId, stepId: getInitialSelectedStepId(model, categoryId) };
}
