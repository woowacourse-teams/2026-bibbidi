export interface RecommendedCatalogItemModel {
  category: string;
  catalogItemId: number;
  stepName: string;
  title: string;
}

export interface RecommendedCatalogItemListModel {
  items: RecommendedCatalogItemModel[];
}
