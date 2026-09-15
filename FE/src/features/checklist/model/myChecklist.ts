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
  id: number;
  isDone: boolean;
  sourceCatalogItemId: number | null;
  title: string;
}

export interface MyChecklistModel {
  exists: boolean;
  items: MyChecklistItemModel[];
}
