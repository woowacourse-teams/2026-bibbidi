import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

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
import { RecommendedSchedule } from "./view/RecommendedSchedule";

const TITLE = "추천 할 일";
const STARTER_TITLES = ["웨딩홀 투어", "드레스샵 투어"];
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
        const items = catalog.roadmaps.flatMap((roadmap) => {
          const category = catalog.categories.find(
            (item) => item.id === roadmap.categoryId,
          );
          if (!category) return [];
          return roadmap.steps.flatMap((step) => {
            const detail = catalog.stepDetails.find(
              (item) => item.stepId === step.id,
            );
            return (detail?.tasks ?? []).flatMap((task) => {
              const catalogItemId = Number(task.id);
              if (!Number.isSafeInteger(catalogItemId) || catalogItemId <= 0)
                return [];
              return [
                {
                  category: category.label,
                  catalogItemId,
                  phase: step.order,
                  stepName: step.title,
                  title: task.title,
                },
              ];
            });
          });
        });
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
  const starterItems = STARTER_TITLES.flatMap((title) =>
    remainingItems.filter((item) => item.title === title),
  );
  // Keep offering unsaved tasks from the first roadmap phase after the starting tours are saved.
  const visibleItems =
    starterItems.length > 0
      ? starterItems
      : remainingItems.filter((item) => item.phase === 1).slice(0, 2);

  return (
    <div className="home-dashboard-guest__recommendations">
      {state.status === "complete" && visibleItems.length > 0 ? (
        <RecommendedSchedule
          compact
          onAddTask={addition.add}
          viewModel={{
            ...createRecommendedScheduleViewModel(
              { items: visibleItems },
              addition,
            ),
            title: TITLE,
          }}
        />
      ) : (
        <section
          aria-labelledby="guest-starter-tasks-title"
          className="calendar-planning__card"
        >
          <header>
            <h2 id="guest-starter-tasks-title">{TITLE}</h2>
            <Link to="/preparation">로드맵 전체 보기 ›</Link>
          </header>
          {state.status === "loading" ? (
            <p role="status">할 일을 불러오고 있어요.</p>
          ) : state.status === "error" ? (
            <>
              <p role="alert">할 일을 불러오지 못했어요.</p>
              <button
                type="button"
                className="home-dashboard-state__result-action home-dashboard-state__result-action--button"
                onClick={() => {
                  setState({ status: "loading" });
                  setRevision((revision) => revision + 1);
                }}
              >
                다시 시도
              </button>
            </>
          ) : (
            <p>로드맵에서 준비할 일을 찾아보세요.</p>
          )}
        </section>
      )}
    </div>
  );
}
