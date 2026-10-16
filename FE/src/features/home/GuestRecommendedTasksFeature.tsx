import { useCallback, useEffect, useState } from "react";

import { analytics } from "../../infrastructure/analytics";
import { catalogRepository } from "../catalog";
import {
  PreparationAuthenticationRequiredError,
  usePreparationChecklistRepository,
} from "../preparation";
import { createPreparationItemAddEvent } from "../preparation/analytics/preparationAnalytics";
import type { RecommendedCatalogItemModel } from "./model/recommendedCatalogItem";
import { useRecommendedTaskAddition } from "./useRecommendedTaskAddition";
import { createRecommendedScheduleViewModel } from "./view-model/createRecommendedScheduleViewModel";
import { GuestRecommendedTasks } from "./view/GuestRecommendedTasks";
import {
  createStarterRecommendedItems,
  selectStarterRecommendedItems,
} from "./model/starterRecommendedTasks";

const ignoreAuthenticationRequired = () => undefined;

type StarterTasksState =
  | { status: "loading" | "error" }
  | {
      status: "complete";
      items: RecommendedCatalogItemModel[];
      addedIds: number[];
    };

export function GuestRecommendedTasksFeature({
  onAdded,
  audience = "guest",
  onAuthenticationRequired = ignoreAuthenticationRequired,
}: {
  onAdded?: (id: number, title: string) => void;
  audience?: "guest" | "authenticated";
  onAuthenticationRequired?: () => void;
} = {}) {
  const repository = usePreparationChecklistRepository();
  const [state, setState] = useState<StarterTasksState>({ status: "loading" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      catalogRepository.getCatalog(controller.signal),
      repository.getCatalogItemIds(audience, controller.signal),
    ]).then(
      ([catalog, addedIds]) => {
        if (controller.signal.aborted) return;
        const items = createStarterRecommendedItems(catalog);
        setState({ status: "complete", items, addedIds: addedIds.map(Number) });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof PreparationAuthenticationRequiredError)
          onAuthenticationRequired();
        setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [repository, revision, audience, onAuthenticationRequired]);

  const onSuccess = useCallback(
    (catalogItemId: number, itemCount: number) => {
      const item =
        state.status === "complete"
          ? state.items.find((item) => item.catalogItemId === catalogItemId)
          : undefined;
      if (item) {
        setState((current) =>
          current.status === "complete"
            ? { ...current, addedIds: [...current.addedIds, catalogItemId] }
            : current,
        );
        onAdded?.(catalogItemId, item.title);
      }
      if (item && itemCount > 0)
        analytics.track(
          createPreparationItemAddEvent({
            categoryName: item.category,
            itemCount,
            phase: item.phase,
            source: "calendar_recommendation",
          }),
        );
    },
    [state, onAdded],
  );
  const addition = useRecommendedTaskAddition({
    allowGuestAddition: true,
    authScope: audience,
    isAuthenticated: audience === "authenticated",
    onAuthenticationRequired,
    onSuccess,
    repository,
  });

  const remainingItems =
    state.status === "complete"
      ? state.items.filter(
          (item) =>
            !state.addedIds.includes(item.catalogItemId) &&
            !addition.addedCatalogItemIds.includes(item.catalogItemId),
        )
      : [];
  const visibleItems = selectStarterRecommendedItems(remainingItems);

  return (
    <GuestRecommendedTasks
      status={state.status}
      viewModel={createRecommendedScheduleViewModel(
        { items: visibleItems },
        addition,
      )}
      onAddTask={addition.add}
      onRetry={() => {
        setState({ status: "loading" });
        setRevision((revision) => revision + 1);
      }}
    />
  );
}
