import { useMemo } from "react";

import {
  useMyChecklistCommandRepository,
  useMyChecklistQueryRepository,
} from "../checklist";
import { catalogRepository } from "../catalog";
import { localChecklistDataSource } from "./data-source/localChecklistDataSource";
import { remoteChecklistDataSource } from "./data-source/remoteChecklistDataSource";
import { createChecklistRepository } from "./repository/checklistRepository";
import { createPreparationCatalogRepository } from "./repository/preparationCatalogRepository";

export function usePreparationChecklistRepository() {
  const checklistCommandRepository = useMyChecklistCommandRepository();
  const checklistQueryRepository = useMyChecklistQueryRepository();

  return useMemo(
    () =>
      createChecklistRepository(
        localChecklistDataSource,
        remoteChecklistDataSource,
        checklistCommandRepository,
        checklistQueryRepository,
      ),
    [checklistCommandRepository, checklistQueryRepository],
  );
}

export const preparationCatalogRepository =
  createPreparationCatalogRepository(catalogRepository);
