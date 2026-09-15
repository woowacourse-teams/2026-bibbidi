export interface MyChecklistItemModel {
  isDone: boolean;
  sourceCatalogItemId: number | null;
}

export interface MyChecklistModel {
  exists: boolean;
  items: MyChecklistItemModel[];
}
