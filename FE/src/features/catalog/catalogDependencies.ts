import { remoteCatalogDataSource } from "./data-source/remoteCatalogDataSource";
import { createCatalogRepository } from "./repository/catalogRepository";

export const catalogRepository = createCatalogRepository(
  remoteCatalogDataSource,
);
