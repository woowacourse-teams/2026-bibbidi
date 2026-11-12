import type { CatalogCategoryModel } from "../../catalog";
import type {
  ChecklistQueryModel,
  MyChecklistItemModel,
} from "../../checklist";

export interface AppHeaderSummaryModel {
  categories: AppHeaderCategorySummaryModel[];
  completedTaskCount: number;
  totalTaskCount: number;
}

export interface AppHeaderCategorySummaryModel {
  id: string;
  title: string;
  completedTaskCount: number;
  totalTaskCount: number;
}

export function createAppHeaderSummaryModel(
  checklist: ChecklistQueryModel,
): AppHeaderSummaryModel {
  const categories = checklist.categories.map((category) => {
    const items = category.items;
    return {
      id: category.id,
      title: category.title,
      completedTaskCount: items.filter((item) => item.status === "done").length,
      totalTaskCount: items.length,
    };
  });

  return summarize(categories);
}

export function summarizePersonalChecklist(
  catalogCategories: CatalogCategoryModel[],
  items: MyChecklistItemModel[],
): AppHeaderSummaryModel {
  const categories = new Map(
    catalogCategories.map(({ id, label }) => [
      id,
      { id, title: label, totalTaskCount: 0, completedTaskCount: 0 },
    ]),
  );
  for (const item of items) {
    const id = String(item.categoryId);
    const category = categories.get(id) ?? {
      id,
      title: "기타 준비",
      totalTaskCount: 0,
      completedTaskCount: 0,
    };
    category.totalTaskCount += 1;
    if (item.status === "done") category.completedTaskCount += 1;
    categories.set(id, category);
  }
  return summarize([...categories.values()]);
}

function summarize(
  categories: AppHeaderCategorySummaryModel[],
): AppHeaderSummaryModel {
  return {
    categories,
    completedTaskCount: categories.reduce(
      (total, category) => total + category.completedTaskCount,
      0,
    ),
    totalTaskCount: categories.reduce(
      (total, category) => total + category.totalTaskCount,
      0,
    ),
  };
}
