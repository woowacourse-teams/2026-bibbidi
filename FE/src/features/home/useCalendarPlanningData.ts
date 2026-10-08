import { useCallback, useEffect, useState } from "react";

import {
  ChecklistQueryAuthenticationRequiredError,
  ChecklistQueryRequestAbortedError,
  ChecklistQueryModel,
  useChecklistQueryRepository,
  useMyChecklistRevision,
} from "../checklist";
import { CalendarPlanningLoadState } from "./model/calendarPlanning";
import { RecommendedCatalogItemModel } from "./model/recommendedCatalogItem";
import {
  RecommendedCatalogItemsRepository,
  RecommendedCatalogItemsAuthenticationRequiredError,
  RecommendedCatalogItemsRequestAbortedError,
} from "./repository/recommendedCatalogItemsRepository";

export function useCalendarPlanningData({
  audience,
  recommendedRepository,
  onAuthenticationRequired,
}: {
  audience: "guest" | "authenticated" | undefined;
  recommendedRepository: RecommendedCatalogItemsRepository;
  onAuthenticationRequired: () => void;
}) {
  const query = useChecklistQueryRepository();
  const revision = useMyChecklistRevision();
  const [checklist, setChecklist] = useState<
    CalendarPlanningLoadState<ChecklistQueryModel>
  >({ status: "loading" });
  const [recommended, setRecommended] = useState<
    CalendarPlanningLoadState<RecommendedCatalogItemModel[]>
  >({ status: "loading" });
  const [reload, setReload] = useState(0);
  const [recommendationRevision, setRecommendationRevision] = useState(0);
  const refreshChecklist = useCallback(
    () => setReload((value) => value + 1),
    [],
  );
  const refreshRecommended = useCallback(
    () => setRecommendationRevision((value) => value + 1),
    [],
  );
  const retryChecklist = useCallback(() => {
    setChecklist({ status: "loading" });
    refreshChecklist();
  }, [refreshChecklist]);
  const retryRecommended = useCallback(() => {
    setRecommended({ status: "loading" });
    refreshRecommended();
  }, [refreshRecommended]);

  useEffect(() => {
    if (!audience) return;
    const controller = new AbortController();
    query.getChecklist(audience, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setChecklist({ status: "complete", data });
      },
      (error) => {
        if (
          controller.signal.aborted ||
          error instanceof ChecklistQueryRequestAbortedError
        )
          return;
        if (error instanceof ChecklistQueryAuthenticationRequiredError)
          onAuthenticationRequired();
        setChecklist({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [audience, query, revision, reload, onAuthenticationRequired]);

  useEffect(() => {
    if (audience !== "authenticated") return;
    const controller = new AbortController();
    recommendedRepository.getRecommendedCatalogItems(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setRecommended({ status: "complete", data });
      },
      (error) => {
        if (
          controller.signal.aborted ||
          error instanceof RecommendedCatalogItemsRequestAbortedError
        )
          return;
        if (error instanceof RecommendedCatalogItemsAuthenticationRequiredError)
          onAuthenticationRequired();
        setRecommended({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [
    audience,
    recommendedRepository,
    recommendationRevision,
    onAuthenticationRequired,
  ]);

  return {
    checklist,
    recommended,
    refreshChecklist,
    refreshRecommended,
    retryChecklist,
    retryRecommended,
  };
}
