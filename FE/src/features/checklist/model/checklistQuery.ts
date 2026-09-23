import {
  ChecklistItemStatus,
  MyChecklistAppointmentModel,
} from "./myChecklist";

export type ChecklistAudience = "authenticated" | "guest";

export interface ChecklistQueryItemModel {
  appointments: MyChecklistAppointmentModel[];
  categoryId: string;
  checklistItemId: number | null;
  createdAt?: string | null;
  id: string;
  sourceCatalogItemId: number | null;
  status: ChecklistItemStatus;
  title: string;
}

export interface ChecklistQueryStepModel {
  id: string;
  items: ChecklistQueryItemModel[];
  order: number;
  title: string;
}

export interface ChecklistQueryCategoryModel {
  customItems?: ChecklistQueryItemModel[];
  id: string;
  readonly items: ChecklistQueryItemModel[];
  steps?: ChecklistQueryStepModel[];
  title: string;
}

export interface ChecklistQueryModel {
  categories: ChecklistQueryCategoryModel[];
}

export function getChecklistCategoryItems(
  category: ChecklistQueryCategoryModel,
): ChecklistQueryItemModel[] {
  return category.steps && category.customItems
    ? [...category.steps.flatMap((step) => step.items), ...category.customItems]
    : category.items;
}
