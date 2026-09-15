import { MyChecklistAppointmentModel } from "./myChecklist";

export type ChecklistAudience = "authenticated" | "guest";

export interface ChecklistQueryItemModel {
  appointments: MyChecklistAppointmentModel[];
  categoryId: string;
  checklistItemId: number | null;
  isDone: boolean;
  sourceCatalogItemId: number | null;
  title: string;
}

export interface ChecklistQueryCategoryModel {
  id: string;
  items: ChecklistQueryItemModel[];
  title: string;
}

export interface ChecklistQueryModel {
  categories: ChecklistQueryCategoryModel[];
}
