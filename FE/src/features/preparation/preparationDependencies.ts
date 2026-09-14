import { localChecklistDataSource } from "./data-source/localChecklistDataSource";
import { remoteChecklistDataSource } from "./data-source/remoteChecklistDataSource";
import { remotePreparationCatalogDataSource } from "./data-source/remotePreparationCatalogDataSource";
import { createChecklistRepository } from "./repository/checklistRepository";
import { createPreparationCatalogRepository } from "./repository/preparationCatalogRepository";

export const checklistRepository = createChecklistRepository(
  localChecklistDataSource,
  remoteChecklistDataSource,
);

export const preparationCatalogRepository = createPreparationCatalogRepository(
  remotePreparationCatalogDataSource,
);
