import type { CatalogModel } from "../../catalog";
import type { BalanceGameRecommendation } from "./balanceGame";

export function groupRecommendations(
  items: BalanceGameRecommendation[],
  addedIds: string[],
) {
  const added = new Set(addedIds);
  const categories = new Map<string, BalanceGameRecommendation[]>();
  for (const item of items) {
    const group = categories.get(item.categoryName);
    if (group) group.push(item);
    else categories.set(item.categoryName, [item]);
  }
  return Array.from(categories, ([category, items]) => ({
    category,
    items: items.sort(
      (left, right) =>
        Number(added.has(String(left.catalogItemId))) -
        Number(added.has(String(right.catalogItemId))),
    ),
  }));
}

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
