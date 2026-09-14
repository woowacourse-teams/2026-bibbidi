export interface MyChecklistItemModel {
  isDone: boolean;
  sourceCatalogItemId: number | null;
}

export interface MyChecklistModel {
  items: MyChecklistItemModel[];
}
