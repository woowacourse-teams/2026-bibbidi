export type ChecklistItemStatus = "prev" | "continue" | "done";

export function isChecklistItemStatus(
  value: unknown,
): value is ChecklistItemStatus {
  return value === "prev" || value === "continue" || value === "done";
}

export interface MyChecklistAppointmentModel {
  date: string;
  endTime: string | null;
  id: number;
  isDone: boolean;
  memo: string | null;
  place: string | null;
  startTime: string | null;
  title: string;
}

export interface MyChecklistItemModel {
  appointments: MyChecklistAppointmentModel[];
  categoryId: number;
  createdAt: string | null;
  id: number;
  sourceCatalogItemId: number | null;
  status: ChecklistItemStatus;
  title: string;
}

export interface MyChecklistModel {
  exists: boolean;
  items: MyChecklistItemModel[];
}
