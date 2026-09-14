import { useMemo } from "react";

import { useMyChecklistQueryRepository } from "../checklist";
import { createAppHeaderSummaryRepository } from "./repository/appHeaderSummaryRepository";

export function useAppHeaderSummaryRepository() {
  const checklistRepository = useMyChecklistQueryRepository();

  return useMemo(
    () => createAppHeaderSummaryRepository(checklistRepository),
    [checklistRepository],
  );
}
