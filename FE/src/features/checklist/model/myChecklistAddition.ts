import { MyChecklistItemModel } from "./myChecklist";

export interface AddedChecklistCatalogItemModel {
  catalogItemId: number;
  categoryId: number;
  id: number;
  status: "prev";
  title: string;
}

export function toMyChecklistItemModel(
  item: AddedChecklistCatalogItemModel,
): MyChecklistItemModel {
  return {
    appointments: [],
    categoryId: item.categoryId,
    id: item.id,
    isDone: false,
    sourceCatalogItemId: item.catalogItemId,
    title: item.title,
  };
}
