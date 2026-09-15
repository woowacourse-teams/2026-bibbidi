import { useMemo } from "react";

import {
  useMyChecklistQueryRepository,
  useMyChecklistRevision,
} from "../checklist";
import { createAppHeaderSummaryRepository } from "./repository/appHeaderSummaryRepository";

export function useAppHeaderSummaryRepository() {
  const checklistRepository = useMyChecklistQueryRepository();

  return useMemo(
    () => createAppHeaderSummaryRepository(checklistRepository),
    [checklistRepository],
  );
}

export function useAppHeaderChecklistRevision() {
  return useMyChecklistRevision();
}
