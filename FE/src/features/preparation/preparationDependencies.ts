import { useMemo } from "react";

import { useMyChecklistQueryRepository } from "../checklist";
import { localChecklistDataSource } from "./data-source/localChecklistDataSource";
import { remoteChecklistDataSource } from "./data-source/remoteChecklistDataSource";
import { remotePreparationCatalogDataSource } from "./data-source/remotePreparationCatalogDataSource";
import { createChecklistRepository } from "./repository/checklistRepository";
import { createPreparationCatalogRepository } from "./repository/preparationCatalogRepository";

export function usePreparationChecklistRepository() {
  const checklistQueryRepository = useMyChecklistQueryRepository();

  return useMemo(
    () =>
      createChecklistRepository(
        localChecklistDataSource,
        remoteChecklistDataSource,
        checklistQueryRepository,
      ),
    [checklistQueryRepository],
  );
}

export const preparationCatalogRepository = createPreparationCatalogRepository(
  remotePreparationCatalogDataSource,
);
