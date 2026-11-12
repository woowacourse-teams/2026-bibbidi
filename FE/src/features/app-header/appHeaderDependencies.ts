import { useMemo } from "react";

import {
  useChecklistQueryRepository,
  useMyChecklistRevision,
  useMyChecklistQueryRepository,
} from "../checklist";
import type { CatalogCategoryModel } from "../catalog";
import {
  createAppHeaderSummaryRepository,
  createSnapshotHeaderSummaryRepository,
} from "./repository/appHeaderSummaryRepository";
import { createWeddingDateRepository } from "./repository/weddingDateRepository";

export function useAppHeaderSummaryRepository(
  catalogCategories?: CatalogCategoryModel[],
) {
  const checklistRepository = useChecklistQueryRepository();
  const personalRepository = useMyChecklistQueryRepository();

  return useMemo(
    () =>
      catalogCategories
        ? createSnapshotHeaderSummaryRepository(
            catalogCategories,
            personalRepository,
          )
        : createAppHeaderSummaryRepository(checklistRepository),
    [catalogCategories, checklistRepository, personalRepository],
  );
}

export function useAppHeaderChecklistRevision() {
  return useMyChecklistRevision();
}

export function useWeddingDateRepository() {
  return useMemo(() => createWeddingDateRepository(), []);
}
