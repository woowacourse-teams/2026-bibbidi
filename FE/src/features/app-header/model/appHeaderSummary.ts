import type { ChecklistQueryModel } from "../../checklist";

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
