import { useMemo } from "react";

import {
  useChecklistQueryRepository,
  useMyChecklistRevision,
} from "../checklist";
import { createAppHeaderSummaryRepository } from "./repository/appHeaderSummaryRepository";
import { createWeddingDateRepository } from "./repository/weddingDateRepository";

export function useAppHeaderSummaryRepository() {
  const checklistRepository = useChecklistQueryRepository();

  return useMemo(
    () => createAppHeaderSummaryRepository(checklistRepository),
    [checklistRepository],
  );
}

export function useAppHeaderChecklistRevision() {
  return useMyChecklistRevision();
}

export function useWeddingDateRepository() {
  return useMemo(() => createWeddingDateRepository(), []);
}
