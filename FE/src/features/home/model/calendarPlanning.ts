import type {
  ChecklistQueryModel,
  ChecklistQueryItemModel,
} from "../../checklist";
import { getChecklistCategoryItems } from "../../checklist/model/checklistQuery";

export type CalendarPlanningLoadState<T> =
  { status: "loading" | "error" } | { status: "complete"; data: T };
export type CalendarPlanningTask = ChecklistQueryItemModel & {
  category: string;
};

export function createCalendarPlanningModel(
  checklist: ChecklistQueryModel | undefined,
) {
  const tasks: CalendarPlanningTask[] = checklist
    ? checklist.categories.flatMap((category) =>
        getChecklistCategoryItems(category).map((item) => ({
          ...item,
          category: category.title,
        })),
      )
    : [];
  return {
    tasks,
    undated: tasks.filter(
      (item) => item.status !== "done" && item.appointments.length === 0,
    ),
    schedules: tasks.flatMap((task) =>
      task.appointments.map((appointment) => ({
        ...appointment,
        checklistItemId: task.checklistItemId ?? undefined,
        taskTitle: task.title,
      })),
    ),
    addedCatalogItemIds: new Set(
      tasks.flatMap((task) =>
        task.sourceCatalogItemId === null ? [] : [task.sourceCatalogItemId],
      ),
    ),
  };
}

export function getLocalDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
