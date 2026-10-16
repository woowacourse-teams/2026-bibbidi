import type { CatalogModel } from "../../catalog";
import type { RecommendedCatalogItemModel } from "./recommendedCatalogItem";

const STARTER_TITLES = ["웨딩홀 투어", "드레스샵 투어"];

export function createStarterRecommendedItems(
  catalog: CatalogModel,
): RecommendedCatalogItemModel[] {
  return catalog.roadmaps.flatMap((roadmap) => {
    const category = catalog.categories.find(
      (item) => item.id === roadmap.categoryId,
    );
    if (!category) return [];
    return roadmap.steps.flatMap((step) => {
      const detail = catalog.stepDetails.find(
        (item) => item.stepId === step.id,
      );
      return (detail?.tasks ?? []).flatMap((task) => {
        const catalogItemId = Number(task.id);
        if (!Number.isSafeInteger(catalogItemId) || catalogItemId <= 0)
          return [];
        return [
          {
            category: category.label,
            catalogItemId,
            phase: step.order,
            stepName: step.title,
            title: task.title,
          },
        ];
      });
    });
  });
}

export function selectStarterRecommendedItems(
  remainingItems: RecommendedCatalogItemModel[],
): RecommendedCatalogItemModel[] {
  const starterItems = STARTER_TITLES.flatMap((title) =>
    remainingItems.filter((item) => item.title === title),
  );
  // Keep offering unsaved tasks from the first roadmap phase after the starting tours are saved.
  return starterItems.length > 0
    ? starterItems
    : remainingItems.filter((item) => item.phase === 1).slice(0, 2);
}
