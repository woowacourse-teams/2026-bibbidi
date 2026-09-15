import { useMemo } from "react";

import { catalogRepository } from "../catalog";
import {
  useMyChecklistQueryRepository,
  useMyChecklistRevision,
} from "./MyChecklistProvider";
import { localChecklistDataSource } from "./data-source/localChecklistDataSource";
import { createChecklistQueryRepository } from "./repository/checklistQueryRepository";

export function useChecklistQueryRepository() {
  const myChecklistQueryRepository = useMyChecklistQueryRepository();

  return useMemo(
    () =>
      createChecklistQueryRepository(
        catalogRepository,
        localChecklistDataSource,
        myChecklistQueryRepository,
      ),
    [myChecklistQueryRepository],
  );
}

export function useChecklistRevision() {
  return useMyChecklistRevision();
}
