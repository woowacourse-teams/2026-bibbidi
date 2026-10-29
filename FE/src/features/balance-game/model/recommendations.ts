import type { CatalogModel } from "../../catalog";
import type { BalanceGameRecommendation } from "./balanceGame";

export function resolveRecommendations(
  ids: number[],
  catalog: CatalogModel,
): BalanceGameRecommendation[] {
  const found = new Map<number, BalanceGameRecommendation>();
  for (const roadmap of catalog.roadmaps) {
    const category = catalog.categories.find(
      (value) => value.id === roadmap.categoryId,
    );
    for (const step of roadmap.steps) {
      const detail = catalog.stepDetails.find(
        (value) => value.stepId === step.id,
      );
      for (const task of detail?.tasks ?? []) {
        const catalogItemId = Number(task.id);
        if (category && ids.includes(catalogItemId))
          found.set(catalogItemId, {
            catalogItemId,
            title: task.title,
            categoryName: category.label,
            stepName: step.title,
          });
      }
    }
  }
  if (ids.some((id) => !found.has(id)))
    throw new Error("추천 할 일의 카탈로그 정보를 찾지 못했어요.");
  return ids.map((id) => found.get(id)!);
}
