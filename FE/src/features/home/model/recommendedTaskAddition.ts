export interface RecommendedTaskAdditionState {
  addedCatalogItemIds: readonly number[];
  addingCatalogItemIds: readonly number[];
  additionErrors: Readonly<Record<number, string>>;
}
