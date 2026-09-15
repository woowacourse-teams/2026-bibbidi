import { useMemo } from "react";

import {
  useMyChecklistCommandRepository,
  useMyChecklistQueryRepository,
} from "../checklist";
import { localChecklistDataSource } from "./data-source/localChecklistDataSource";
import { remoteChecklistDataSource } from "./data-source/remoteChecklistDataSource";
import { remotePreparationCatalogDataSource } from "./data-source/remotePreparationCatalogDataSource";
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

export const preparationCatalogRepository = createPreparationCatalogRepository(
  remotePreparationCatalogDataSource,
);
