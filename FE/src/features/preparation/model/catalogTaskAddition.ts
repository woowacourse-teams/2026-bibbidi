export interface CatalogTaskAdditionState {
  addedCatalogItemIds: readonly number[];
  addingCatalogItemIds: readonly number[];
  additionErrors: Readonly<Record<number, string>>;
}
